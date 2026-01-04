const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const { parseArgsStringToArgv } = require('string-argv');
const crypto = require('crypto');
const app = express();
const os = require('os');

let listen_port = 5001;
let m_queues = {"default":{}};

// UNHANDLED EXCEPTION
process.on('uncaughtException', function(err) {
  console.trace('Global uncaughtException error: ' , err);
  if (err.stack){
    err.stackTraceLimit = Infinity;
    console.error(err.stack);
  } 
});

process.on('unhandledRejection', (reason, promise) => {
  console.trace('Global unhandledRejection error: ' , reason);
  if (reason.stack) {
    console.error(reason.stack);
  }
})

// HTTP METHODS
app.use('/', function(req, res, next) {
  req.headers['content-type'] = "application/json";
  next();
});

app.use(express.json());

app.listen(listen_port, () => {
  console.log('Server is running on port ' + listen_port);
});

processQueues(); // keeps this process running forever

app.get('/status', (req, res) => {
  var found_job = findJobById(req.query.job_id);
  if (!found_job){
    return res.status(400).send({
      message: 'job_id [' + req.query.job_id + "] was not found "
    });
  }
  else {
    // remove spawn from job (too lengthy)
    const clone = (({ spawn, ...o }) => o)(found_job);
    res.json(clone);
  }
})

app.post('/find', (req, res) => { 
  let a_jobs = findJobsByObject(req.body);
  return res.json(a_jobs);
})

app.get('/kill', (req, res) => {
  let job = findJobById(req.query.job_id);
  if (!job) return res.status(404).send("Job not found");
  
  try {
    job.exit_code = -1;
    job.end = new Date().toISOString();
    job.status = 'KILLED'; // Update status
    job.is_running = false;
    job.stderr.push("Cancelled at " + job.end);
    if (job.spawn) job.spawn.kill('SIGINT');
  } catch(ex) {
    return res.status(400).send({ message: 'error killing job,' + ex });
  }
  return res.status(200).send({ message: 'job_id [' + req.query.job_id + "] killed" });
})

app.post('/start', async (req, res) => {
  const command = req.body.command;
  console.log("new start request:" ,req.body);
    
  var id = crypto.randomUUID();
  var queue_item = {
    id: id,
    discover: req.protocol + "://" + req.hostname + ":" + listen_port + "/?job_id=" + id,
    status: 'QUEUED', // New explicit status tracking
    start: false,
    end: false,
    exit_code: false,
    is_running: false,
    command: command,
    queue_name: req.body.queue_name || "default",
    created: req.body.created || new Date().toISOString(),
    spawn: false,
    stdout: [],
    stderr: [],
  };

  if (!(queue_item.queue_name in m_queues)){
    console.log("Creating new queue :" + queue_item.queue_name)
    m_queues[queue_item.queue_name] = {}
  }
  m_queues[queue_item.queue_name][id] = queue_item;
  console.log("Queue job success:",command);
  res.json(queue_item);
});

// FUNCTIONS
async function processQueues(){
  const max_job_age_ms = 60 * 60 * 24 * 1000; // 1 day
  while (true){
    await sleep(1000);
    try {
      Object.keys(m_queues).forEach(qid => {
        let queue = m_queues[qid];
        Object.keys(queue).forEach(jid => {
          let job = queue[jid];
          
          if (job.end) {
            // deletes old jobs
            if (new Date() - Date.parse(job.end) > max_job_age_ms){
              delete queue[jid];
            }
            return;
          }

          // FIX: Check status instead of just !job.start to prevent double-triggering
          if (job.status === 'QUEUED'){ 
            try {
              job.status = 'STARTING'; // Immediate lock
              console.log(`[${job.id}] starting job`, job.command)
              start_job(job);
            } catch(ex) {
              job.exit_code = -1;
              job.end = new Date().toISOString();
              job.status = 'FAILED';
              job.is_running = false;
              job.stderr.push(ex.stack);
            }
          }
        });
      });
    } catch(ex) {
      console.error("fatal unexpected", ex)
    }
  }
}

function start_job(job){
const isWin = os.platform() === 'win32';
    
    let shellPath;
    let shellArgs;
    let options = { windowsVerbatimArguments: true };

    if (isWin) {
        shellPath = 'cmd.exe';
        // We wrap the entire command in an extra set of quotes.
        // This prevents cmd /S /C from breaking the internal quoted paths.
        shellArgs = ['/S', '/C', `"${job.command}"` ];
    } else {
        shellPath = '/bin/sh'; //untested!
        shellArgs = ['-c', job.command];
    }

    let spawned = spawn(shellPath, shellArgs, options);

    job.start = new Date().toISOString();
    job.spawn = spawned;
    job.is_running = true;
    job.status = 'RUNNING';

    spawned.stdout.on('data', (data) => {
      job.stdout.push(data.toString());
    });

    spawned.stderr.on('data', (data) => {
      job.stderr.push(data.toString());
    });

    spawned.on('close', (code) => {
      console.log(`[${job.id}] job process close`, job.command)
      job.exit_code = code;
      job.end = new Date().toISOString();
      job.status = 'FINISHED';
      job.is_running = false;
      delete job.spawn; // FIXED: Changed from job.spawned to job.spawn
    });

    spawned.on('error', (err) => {
      console.log(`[${job.id}] job process error`, job.command)
      job.exit_code = -1;
      job.stderr.push(err.message)
      job.end = new Date().toISOString();
      job.status = 'ERROR';
      job.is_running = false;
      delete job.spawn; // FIXED: Ensure cleanup on error too
    })
}

// HELPERS
function sleep (time) {return new Promise(res => setTimeout(res, time, "done sleeping"))};

function findJobById(job_id){
  let found = null;
  Object.values(m_queues).forEach(queue => {
    if (queue[job_id]) found = queue[job_id];
  });
  return found;
}

function findJobsByObject(compare_obj){
  // Check for empty object to prevent returning everything and crashing
  if (Object.keys(compare_obj).length === 0) return [];
  
  var found_jobs = [];
  Object.values(m_queues).forEach(queue => {
    Object.values(queue).forEach(job => {
      var _matchcnt = 0;
      var keys = Object.keys(compare_obj);
      keys.forEach(_k => {
        if (job[_k] == compare_obj[_k]) _matchcnt++;
      });
      if (_matchcnt == keys.length) found_jobs.push(job);
    })
  })
  return found_jobs;
}