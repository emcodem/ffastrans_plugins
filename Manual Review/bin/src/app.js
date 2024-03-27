const fs = require("fs");
const path = require('path')

    class ReviewTask {
    //template for creating review tasks
    constructor() {
        this.workflow = {}; //workflow json of current wf
        this.job = {}; //contents of inputs.json of this processor
        this.outbounds = []; //guid of next processor
        this.source = ""; //source file
        this.variables = []; //user vars

    }
}

//read input job customticket
let rawdata = fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM

let o_job = JSON.parse(rawdata);
let workflow_path = o_job.workflow.path;

if (!("variables" in o_job)) {
    o_job.variables = []
}

//support non saved review processor
if (! ("proc_data" in o_job) || o_job.proc_data == null){
	//processor gui has not been saved yet, so no "inputs" in proc_data
	o_job["proc_data"] = {"inputs":[],"outputs":[]}
}else{
	console.log("Proc_data exists: ",o_job.proc_data)
}

//modify current ticket so the main branch does not go on

if (!"outputs" in o_job["proc_data"])
	o_job["proc_data"].outputs = []


o_job["proc_data"]["outputs"].push({
    "value": "s_end_branch",
    "data": "true"
}); //forcefully ends the main branch with success in ffastrans <= 1.3

o_job["proc_data"]["outputs"].push({
    "value": "s_options",
    "data": "end_branch=True"
}); //forcefully ends the main branch with success >= 1.4

create_review_task()

//write output json for main branch
var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {
    flags: 'w'
});

//prevents ffastrans from failing because value for webui_vars is not yet filled out
o_job.proc_data.outputs.push({
	"value": "s_job_error_msg",
	"data": "" //empty value convinces ffastrans not to fail
});
outfile.write(JSON.stringify(o_job));

//END


function end_with_errror(msg) {
    //reset outputs so we dont write an empty s_source or such
    o_job["proc_data"]["outputs"] = []
    o_job["proc_data"]["outputs"].push({
        "value": "s_job_error_msg",
        "data": msg
    })

    console.log("Ending with error,", msg, " writing output file, ", o_job["processor_output_filepath"])
    fs.writeFileSync(o_job["processor_output_filepath"], JSON.stringify(o_job))
    process.exit(2);
}

async function create_review_task() {

    var this_ticket_file = o_job["ticket_file"];
    console.log("ticket_file", this_ticket_file)
    var o_this_ticket = JSON.parse(fs.readFileSync(this_ticket_file, 'utf8').replace(/^\uFEFF/, ""));

    var cache_dir = o_job["cache_dir"];
    var this_jobguid = o_job["job_id"] || o_job["id"];

    console.log("reading workflow file:", workflow_path);
    rawdata = fs.readFileSync(workflow_path, 'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM
    //fs.writeFileSync("c:\\temp\\processorticket.json",rawdata)
    var o_workflow = JSON.parse(rawdata);

    //get own node from jobticket
    var this_nodeid = o_job["nodes"]["next"]["id"];
    //get next node from workflow
    var o_this_node = filterById(o_workflow["nodes"], this_nodeid);
    //get outbounds of self node in workflow
    var a_outbounds = o_this_node["outbounds"];
    if (a_outbounds == null) {
        end_with_errror("No outbound processors detected, you must connect a follow up processor");
    }
    if (a_outbounds.length == 0) {
        end_with_errror("You must connect a follow up processor");
    }

    //ensure review queue folder exists

    var reviewfolder = path.dirname(this_ticket_file);

    try {
        reviewfolder = path.resolve(reviewfolder, "../../review")
            console.log("Creating review folder", reviewfolder)
            await fs.promises.mkdir(reviewfolder, 0o744);
    } catch (ex) {
        if (ex.code != 'EEXIST') {
            end_with_errror("Could not create review folder " + reviewfolder + ex.stack);
        }
    }

    try {

        reviewfolder = path.join(reviewfolder, "queue")
            console.log("Creating review folder", reviewfolder)
            await fs.promises.mkdir(reviewfolder, 0o744);
    } catch (ex) {
        if (ex.code != 'EEXIST') {
            end_with_errror("Could not create review folder " + reviewfolder + ex.stack);
        }
    }

    var t = new ReviewTask();
    t.workflow = o_workflow; //workflow json of current wf
    t.job = o_job; //contents of inputs.json of this processor

    for (let i = 0; i < a_outbounds.length; i++) {
        var _cur = a_outbounds[i];
        var o_next_node = filterById(o_workflow["nodes"], _cur["id"]);
        if (o_next_node["bypass"]) {
            end_with_errror("The next Node after this processor cannot be bypassed");
        }
        if (o_next_node["bypass"]) {
            end_with_errror("Direct follow up processors after this processor cannot be bypassed");
        }
        t.outbounds.push(o_next_node);
        //guid of next processor
    }
	//create review ticket 
    var jid = o_job["job_id"];
    var final_filename = path.join(reviewfolder, t.workflow.wf_name + "~" + jid + ".json");
    console.log("Creating review ticket", final_filename)
	fs.writeFileSync(final_filename, JSON.stringify(t));
}

function filterByName(array, string) {
    //finds by key in input variable array 
	for (idx in array) {
        if (array[idx].name == string) {
            return array[idx];
        }
    }
    return false;
}

function filterById(array, string) {
    //finds by key in input variable array 
	for (idx in array) {
        if (array[idx].id == string) {
            return array[idx];
        }
    }
}
