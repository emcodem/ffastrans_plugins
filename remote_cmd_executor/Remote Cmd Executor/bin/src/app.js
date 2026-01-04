const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const os = require("os");

//globals
let max_retries = 20;
let m_selected_host;

//read input job ticket
let rawdata = fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM

let o_job = JSON.parse(rawdata);
console.log(o_job["proc_data"]);

//GET OUTPUTS - make them available as global objects
var output_stdout = filterById(o_job["proc_data"]["outputs"],"stdout");
var output_stderr = filterById(o_job["proc_data"]["outputs"],"stderr");

//GET INPUTS // the fields in this object was defined by the index.html which belongs to this processor
var ffastrans_root = filterById(o_job["proc_data"]["inputs"], "s_ffastrans_dir")["value"];
var hostnames = filterById(o_job["proc_data"]["inputs"], "hostnames")["value"] || "localhost";
hostnames = comma_to_array(hostnames);

var queue_name = filterById(o_job["proc_data"]["inputs"], "queue_name")["value"];
var max_concurrent = filterById(o_job["proc_data"]["inputs"], "concurrency")["value"];
var fireandforget = filterById(o_job["proc_data"]["inputs"], "fireandforget")["value"];
var cmd = filterById(o_job["proc_data"]["inputs"], "cmd")["value"];

var date_created = new Date().toISOString();

//concurrent/synchronisation related variables
let m_node_id = o_job.nodes.next.id;
let m_sync_dir = path.join(ffastrans_root,"Processors","db","cache","plugin_procs","remote_cmd_executor",queue_name);

let m_my_sync_file = path.join(m_sync_dir, Math.random() + "_sync.json"); //unique name for this processor instance


console.log("Inputs: ", hostnames,queue_name,max_concurrent,fireandforget,cmd);

// MAIN

fs.ensureDirSync(m_sync_dir);
fs.writeFileSync(m_my_sync_file,rawdata);
main(); //DO THE WORK


//FUNCTIONS


async function main(){
	var job;
	var do_poll = !fireandforget;
	//call the webservice until conditions are met
	var response = {};
	try{	
		let job_started = false;
		let startretrycount = 0;
		while (!job_started){

			if (queue_name && max_concurrent){
				while(await get_least_busy_host(hostnames,queue_name) >= max_concurrent){
					console.log("Queued, slots full. Running:",get_least_busy_host(hostnames,queue_name),"Allowed:",max_concurrent);
					await sleep(1000);
				}
				//m_selected_host has a slot free, check if we are the oldest one waiting for tickets
				var queuecheck = am_i_the_oldest_one();
				if (!queuecheck.can_start){
					console.log("Queued, Jobs waiting: ",queuecheck.count, "can_start",queuecheck.can_start);
					await sleep(1000); //prevent log overload on error
					continue;
				}
			}else{
				m_selected_host = hostnames[Math.floor(Math.random() * hostnames.length)];
				console.log("No queue or concurrency limits set, selecting random host ",m_selected_host);
			}
			
			try{
				console.log("Starting Job on host ",m_selected_host)
				response = await start_job(); //waits 5 seconds to see if there are younger jobs coming in. If there was a younger one, 406 is returned
				job = response.data;
				job_started = true;
				fs.unlinkSync(m_my_sync_file); //remove sync file
				console.log("start job success",job.id,"command: [",job.command,"] on host ",m_selected_host)
			}catch(ex){
				if (ex.response)
					if(ex.response.status == 303) //"see other, there was an older job than this one submitted in the last 5 seconds"
						continue
				console.log("start job exception",ex)
				startretrycount ++
			}
			if (startretrycount > 2){
				throw new Error("Start job retry count exhausted.")
			}			
		}
	}catch(e){
		console.log("Start job error",e);
		endProgram(1);
	}
	
	//job has been started, now wait for finish if needed.
	var retry_count = 0;
	
    while(do_poll){
       await sleep(1000);
	   try{
		   response = await get_job_status(job.id)
		   if (response.status != 200)
				throw new Error(`${job.id} Status code ${response.status}`);
		   if (response.data.end){
				do_poll = false;
				console.log(`${job.id} Job end detected.`)
		   }
		
	   }catch(ex){
			if (retry_count > max_retries)
				do_poll = false;
			else
				console.error(`${job.id} Got error  in get job status, retrying. Code: `,ex)
	   }
	   //todo: implement error handling? 

    }//retry while
		
        
	//end processor
	//decide final exit code

	var statuscode = 0;
    var responseBody = response["data"];
    statuscode = response["status"];
   
	console.log(`${job.id} Final respons`,responseBody)
	console.log(`${job.id} Final response code: ` , statuscode);
	console.log(`${job.id} stdouterr`,responseBody.stdout,responseBody.stderr)

	output_stdout["data"] = responseBody.stdout.join("\n").trim();
	output_stderr["data"] = responseBody.stderr.join("\n").trim();

	write_output();	
	if (responseBody.exit_code != 0){
		endProgram(responseBody.exit_code);
	}
	
	if (! (statuscode > 199 && statuscode < 300)){ 
		console.log(`${job.id} Status codes other than 2xx are threated as error`);
		endProgram(statuscode);
	}
	console.log(`${job.id} Graceful exit`);
	endProgram(0);
}

//FUNCTIONS

function endProgram(code){
	try{
		//it is important to delete our own sync file in the end 
		fs.unlinkSync(m_my_sync_file);
	}catch(ex){}
	process.exit(code)
}

const olderThan15Secs = (date) => {
    const checkDate = Date.now() - 50010;
    return date < checkDate;
}

function am_i_the_oldest_one(){
	var can_start = {can_start:true,count:"Error counting syncfiles"};
	try{
		//before starting job, checks if from all files in syncdir, we are the oldest one.
		var syncfiles = fs.readdirSync(m_sync_dir);
		var mystat = fs.statSync(m_my_sync_file);
		var oldestname = 0;
		var oldeststat = {birthtime:Infinity};
		if (syncfiles.length == 0){
			console.log("Erorr, did not find any syncfiles, assuming we can go on and start");
			return can_start;
		}
		syncfiles.forEach(f=>{
			var otherstat = fs.statSync(path.join(m_sync_dir,f));
			if (otherstat.birthtime < oldeststat.birthtime){
				oldeststat = otherstat;
				oldestname = f;
			};	//if any other is older, iAmNext = false 
			if (olderThan15Secs(otherstat.atime)){ //orphaned deletion
				console.log("Deleting orphaned sync file " + path.join(m_sync_dir,f));
				fs.unlinkSync(path.join(m_sync_dir,f))
			}
		});

		fs.writeFileSync(m_my_sync_file,rawdata); //updates date modified/access for orphaned check
		
		console.log("am_i_the_oldest_one check found ",syncfiles.length,"files","in",m_sync_dir);
		console.log("am_i_the_oldest_one mystat ",mystat.birthtime.toISOString(),"oldest",oldeststat.birthtime.toISOString())
	}catch (ex){
		console.log("Error checking sync files, this should only happen sporadically",ex);
		return {can_start:false,count:"Error counting syncfiles,",ex};
	}

	return {count:syncfiles.length,can_start:oldeststat.birthtime.toISOString() == mystat.birthtime.toISOString()};
}


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function kill(job_id){
	console.log("executing job kill")
	axios.get("http://" + m_selected_host + ":5001/kill?job_id=" +job_id);
}

function register_cancel_listener(job_id){
	console.log("Registering Cancel listeners")
	//cancelling
	process.on('SIGINT', () => {
		kill(job_id);
	});  // CTRL+C
	process.on('SIGQUIT', () => {
		kill(job_id);
	}); // Keyboard quit
	process.on('SIGTERM', () => {
		kill(job_id);
	}); // `kill` command
}

async function start_job(){

	var res = await axios.post("http://" + m_selected_host + ":5001/start"
			,{
				command: cmd,
				concurrency: max_concurrent || 5,
				queue_name : queue_name || "default",
				created : date_created
			});

	
	//var res = await client["postPromise"]("/execute", args); //method name is like getPromise,postPromise etc
	console.log("Start Job Command:",cmd)
	console.log("Start Job Status code:",res.status);
	console.log("Response data",res["data"]);
	register_cancel_listener(res["data"].id);
	return res;

}

async function get_job_status(job_id){
	console.log("Calling url " + "http://" + m_selected_host + ":5001/status?job_id=" +job_id)
	var res = await axios.get("http://" + m_selected_host + ":5001/status?job_id=" +job_id);
	
	//console.log("Response data",res["data"]);
	console.log("stdout",job_id,res["data"].stdout[res["data"].stdout.length-1])
	
	return res;

}


function write_output(){
	console.log("Writing ffastrans output file",o_job["processor_output_filepath"])
	fs.writeFileSync(o_job["processor_output_filepath"],JSON.stringify(o_job,null,3),"utf8");
}

//
//HELPERS
//

async function get_least_busy_host(a_hosts,queue_name){
	//find a the host that has least jobs in the queue_name
	var least_busy_name;
	var least_busy_jobcount = Infinity;
	for (let host of a_hosts){
		var res = await axios.post("http://" + host + ":5001/find",
		{
			end:false,
			queue_name:queue_name
		});
		console.log("Least busy answer from ",host,":",res.data.length);
		
		//check if any host as a free processing slot for the current queue

		if (res.data.length <= least_busy_jobcount){
			m_selected_host = host; //we can safely always set the least busy host, someone else will decide if we need to call again
			least_busy_jobcount = res.data.length;
		}

	}
	console.log("Found least busy host is " + m_selected_host + " with " + least_busy_jobcount + " jobs");
	return least_busy_jobcount;
}

function comma_to_array(what){
    what = what.split(",");
    return what;
    
}

function filterByTerm(array, string){
//fuzzy term matching
    var out = [];
    for (idx in array){
        console.log(array[idx].id);
        if (array[idx].id.indexOf(string) != -1){
            out.push(array[idx]);
        }
    }
    return out;
}

function filterById(array, string) {
//finds by key in input variable array
    for (idx in array){
        if (array[idx].id == string){
            return array[idx];
        }
    }
}
