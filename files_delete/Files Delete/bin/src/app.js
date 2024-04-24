var dir_recursive = require("recursive-readdir");
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

//GET OUTPUTS - make them available as global objects
var o_out_files = filterById(o_job["proc_data"]["outputs"],"deleted_items");
var o_out_count = filterById(o_job["proc_data"]["outputs"],"deleted_count");


//GET INPUTS // the fields in this object was defined by the index.html which belongs to this processor
var root_path = filterById(o_job["proc_data"]["inputs"], "path")["value"];

var recursive = filterById(o_job["proc_data"]["inputs"], "recurse")["value"];  //a checkbox in html has value "on" if enabled
console.log("Input recursive: " + recursive);
var ignore_errors = filterById(o_job["proc_data"]["inputs"], "ignore_errors")["value"];  
console.log("Input ignore_errors: " + ignore_errors);
var testmode = filterById(o_job["proc_data"]["inputs"], "testmode")["value"];  
console.log("Input testmode: " + testmode);
var delete_base = filterById(o_job["proc_data"]["inputs"], "delete_base")["value"]; 
console.log("Input delete_base: " + delete_base);
var delete_folders = filterById(o_job["proc_data"]["inputs"], "delete_folders")["value"];  
console.log("Input delete_folders: " + delete_folders);

var existing = [];
try{
    //single file as input?
    console.log("Input is a file.");
    if (fs.existsSync(root_path)){
        existing.push(root_path);
        existing = JSON.stringify(existing);
    }
}catch(ex){
    console.log("Input is not a file, threated as JSON Array.");
}

try {
    /*check if root_path is an array of files*/
    existing = JSON.parse(root_path);
    console.log(existing[0]);
    console.log("Processing File Array, not listing files");
    dir_func = dir_recursive; //we dont actually execute dir_func but it must be dir_recursive for handling absolute paths
    handle_found_files(undefined,existing);
}catch(ex){
    console.log("Listing Files",ex);
    start_filelist();
}

function start_filelist(){
    /*root_path is not an array of files but a file or folder, start listing files...*/
    root_path = format_input_path(root_path);
    console.log("Input path: " + root_path);
    if (delete_base){
        console.log("DELETING BASE DIRECTORY");
        found_folders.push(root_path);
    }

    if (recursive){
        console.log("SEARCHING RECURSIVE");
        dir_func = dir_recursive;
    }
    console.log("Findfiles start "+root_path+"\n");
    dir_func(root_path, handle_found_files);	//end of dir func
}

// FUNCTIONS
function handle_found_files(err, files){
      if (err){
        console.log("Error \n" + err + "\n");
        return;
      }
      
	  // if we are not recursive, we need to stack the path together wit name
	  for (i=0;i<files.length;i++){
		  if (dir_func ==  fs.readdir){
			  files[i] = root_path + files[i];
		  }
		  
          //file or directory
          try{
              console.log("stat",files[i])
              files[i] = files[i].replace(/\\/g,"/")
              var stat = fs.lstatSync(files[i]);
              if (stat.isDirectory()){
                  if (!delete_folders){
                    continue;
                  }else{
                      found_folders.push(files[i]);
                  }
              }else{
                  found_files.push(files[i]);
              }
          }catch(ex){
                console.error("Cannot stat file ", files[i],ex);
          }
	  }
	  

      found_files.sort((a, b) => b.length - a.length)
      found_folders.sort((a, b) => b.length - a.length)
      
      var errors_found = false;
      var error_msgs = "";
      //delete first the files
      for (i=0;i<found_files.length;i++){
          try{
              if (!testmode){
                fs.unlinkSync(found_files[i]);
              }
              all_files.push(found_files[i])
          }catch (ex){
              console.log("Cannot delete ",found_files[i],ex);
              error_msgs+=ex + ", ";
              errors_found = true;
          }
      }
      //delete the folders
      for (i=0;i<found_folders.length;i++){
          try{
              if (!testmode){
                fs.unlinkSync(found_folders[i]);
              }
              all_files.push(found_folders[i])
          }catch (ex){
               console.log("Cannot delete ",found_folders[i],ex);
               error_msgs+=ex + ", ";
               errors_found = true;
          }
      } 
      
      if (errors_found && (!ignore_errors)){
         o_job["proc_data"]["outputs"].push ({"id": "s_job_error_msg","value": "s_job_error_msg","data": error_msgs});
      }else{
          console.log("no errors found")
          
      }
	   o_out_files["data"] = JSON.stringify(all_files);//outputs MUST NOT BE OBJECT! 
	   o_out_count["data"] = all_files.length;
       console.log("Output List:",o_out_files["data"])
       console.log("Output Count:",o_out_count["data"])
       var o_out_array = filterByTerm(o_job["proc_data"]["outputs"],"deleted_items");
       console.log(JSON.stringify(o_job));
	   write_output();
       
       if (errors_found && (!ignore_errors)){
            setTimeout(function(){process.exit(1);}, 1000, 'wait_for_out_file'); 
       }
       
}

function write_output(){
	
	var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {flags : 'w'});
	outfile.write(JSON.stringify(o_job)) ;
	outfile.close();

}

//
//HELPERS
//

function regex_translate(what){
    var regex = what.replace(/\./g,"\.");
    regex = regex.replace(/\*/g,".*");
    regex = regex.replace(/\\/g,"\/");
    if (regex == ""){regex="<_no value_>"}
    return regex;
}

function comma_to_array(what){
    what = what.split(",");
    return 
    
}

function filterByTerm(array, string){
//fuzzy term matching
    var out = [];
    for (idx in array){
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

function format_input_path(what){
    //enusre only forward slashes and a trailing slashes
    what = what.replace(/\\/g,"/");
    if (!what.match("/$")){
        what += "/";
    }
    if (!fs.existsSync(what)) { 
        throw(what + " does not exist");
    }
    return what;
}