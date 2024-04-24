const fs = require("fs");
var dir_func = fs.readdir;
const path = require('path')

//all found items
var found_files =[];
var found_folders = [];
var all_files =[]; //contains deleted items

//read input job ticket
let rawdata = fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM

//log_file.write(rawdata);
let o_job = JSON.parse(rawdata);
console.log(o_job["proc_data"]);

var errormsg = o_job["proc_data"]["inputs"][0]["value"];  //a checkbox in html has value "on" if enabled
console.log("Input errormsg: " + o_job["proc_data"]["inputs"][0]["value"]);
	
o_job["proc_data"]["outputs"].push({value:"s_job_error_msg",data:errormsg})
write_output();
       
 

function write_output(){
	
	var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {flags : 'w'});
	outfile.write(JSON.stringify(o_job)) ;
	outfile.close();

}