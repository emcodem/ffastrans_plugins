var dir_recursive = require("recursive-readdir");
const fs = require("fs");
var dir_func = fs.readdir;
const path = require('path');
var comparer = require("natural-compare-lite");
const matcher = require('matcher');

//prepare logging 
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
log_file.write("Arguments: " + JSON.stringify(process.argv) + "\n") 

//read input job ticket
let rawdata = fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM
log_file.write("JOBTICKET");
//log_file.write(rawdata);
let o_job = JSON.parse(rawdata);
console.log(o_job["proc_data"]);

//GET OUTPUTS - make them available as global objects
var o_out_files = filterById(o_job["proc_data"]["outputs"],"output_found_array");
var o_out_count = filterById(o_job["proc_data"]["outputs"],"output_found_count");


//GET INPUTS // the fields in this object was defined by the index.html which belongs to this processor
var root_path = filterById(o_job["proc_data"]["inputs"], "path")["value"];
root_path = format_input_path(root_path);
console.log("Input path: " + root_path);
var recursive = filterById(o_job["proc_data"]["inputs"], "recurse")["value"];  //a checkbox in html has value "on" if enabled
console.log("Input recursive: " + recursive);
var include = filterById(o_job["proc_data"]["inputs"], "include")["value"];
if (include == ""){
    include = "*";
}

include = include.split(",");
console.log("Input Include: ", include);
var exclude = filterById(o_job["proc_data"]["inputs"], "exclude")["value"];
exclude = exclude.split(",");
//exclude = regex_translate(exclude);   
console.log("Input Exclude: ", exclude);
var skip_folders = filterById(o_job["proc_data"]["inputs"], "skip_folders")["value"];
console.log("Input skip_folders: " + skip_folders);
var skip_files = filterById(o_job["proc_data"]["inputs"], "skip_files")["value"];
console.log("Input skip_files: " + skip_files);
var older_than = filterById(o_job["proc_data"]["inputs"], "timespan")["value"]; //timespan is in seconds
var custom_older_than = filterById(o_job["proc_data"]["inputs"], "timespan_custom")["value"]; //custom date is in hours
var sort_order = filterById(o_job["proc_data"]["inputs"], "sort_order")["value"]; //custom date is in hours
console.log("Input sort_order: " + sort_order);
var output_type = filterById(o_job["proc_data"]["inputs"], "output_type")["value"]; //custom date is in hours
console.log("Input output_type: " + output_type);

var skip_size_val = -1
var skip_size_operator = ">";
try{
	skip_size_val = filterById(o_job["proc_data"]["inputs"], "skip_size")["value"];
	skip_size_operator = filterById(o_job["proc_data"]["inputs"], "skip_size_operator")["value"];
}catch(ex){
	//inputs were added in later version, this allows backward compatibility
	skip_size_val = -1
	skip_size_operator = ">";
}
console.log("Input skip size",skip_size_val);
console.log("Input skip_size_operator",skip_size_operator);

//var wait_for_count = filterById(o_job["proc_data"]["inputs"], "wait_count")["value"]; 
//var wait_time = filterById(o_job["proc_data"]["inputs"], "wait_duration")["value"]; //minutes

if (custom_older_than != ""){
    older_than = custom_older_than * 3600;//translate hours to seconds, custom date overrules normal date
    console.log("Working with custom timespan in seconds: ", older_than);
}

console.log("Input Older Than: " , older_than , "seconds");

if (recursive){
    console.log("SEARCHING RECURSIVE");
    dir_func = dir_recursive;
}
console.log(dir_func)

//search the filesysem
var all_files =[];
findfiles();

function findfiles(){
    console.log("Findfiles start "+root_path+"\n");
	dir_func(root_path,  function (err, files) {
      if (err){
        console.log("Error \n" + err + "\n");
        return;
      }
      console.log("Findfiles found ", files.length ," Files and Folders");
      
      // `files` is an array of file paths
	  for (var i=0;i<files.length;i++){
		  
		  if (dir_func ==  fs.readdir){
			  files[i] = root_path + files[i];
		  }
		  
          //apply include exclude pattern
		  var is_include = false;
          for (var y=0;y<include.length;y++){
			  var cur_pattern = include[y];
			  if (matcher.isMatch(files[i], cur_pattern, {allPatterns:false,caseSensitive: false})){
				  is_include = true;
				  console.log(files[i], "Matches include pattern:",cur_pattern)
			  }
		  }
		  if(!is_include){
			  console.log("No include pattern matches:",files[i]);
			  continue;
		  }
		  
		  var is_exclude = false;
		  for (var y=0;y<exclude.length;y++){
			  var cur_pattern = exclude[y];
			  if (matcher.isMatch(files[i], cur_pattern, {allPatterns:false,caseSensitive: false})){
				  console.log("Exclude pattern",cur_pattern," matches:",files[i]);
				  is_exclude = true;
			  }        			  
		  }
		  if (is_exclude){
			  //console.log("All patterns exclude mismatch:",files[i]);
			  continue;
		  }
         
		  //date
          try{
              var stat = fs.lstatSync(files[i]);
              if (stat.isDirectory() && skip_folders){
                  //console.log("Skipping Folder", files[i]);
                  continue;
              }
              if (!stat.isDirectory() && skip_files){
                  //console.log("Skipping File", files[i]);
                  continue;
              }
              
              if (older_than !== ""){
                  var min_age = new Date().getTime() - older_than * 1000 ;
                  var created = new Date(stat.birthtime).getTime();
                  if (created < min_age) {
                      console.log("Datefilter OK", files[i]);
                  } else{
                     console.log("Datefilter not OK", files[i]);  
                     continue;
                  }
              }else{
                  console.log("no need to check age, older_than is not set",older_than)
                  
              }
          }catch(ex){
                console.error("Cannot stat file ", files[i],ex);
          }
		  
		  //if we come here, file survived all checks, push to good
		  all_files.push(files[i]);

	  }
	  
		//output found items count
		o_out_count["data"] = all_files.length;
	   
		//sort everything
		all_files = sort_output_array(all_files);

		//skip sizes
		all_files = filter_size(all_files);
       //fill single output file output parameters
       var o_out_array = filterByTerm(o_job["proc_data"]["outputs"],"output_files");
	   for (i=0;i<o_out_array.length;i++){
		   if (all_files.length >= i){
			   o_out_array[i]["data"] = all_files[i];
		   }
	    }

	   // ffconcat or json output?
	   if (output_type == "ffconcat"){
		   //ffconcat file output
		   var ffconcat = "ffconcat version 1.0\n";
			for (i=0;i<all_files.length;i++){
				console.log("adding to ffconcat",all_files[i])
				ffconcat += "file '"+ path.basename(all_files[i]) +"'\n";
			}
			o_out_files["data"] = ffconcat;
			console.log("Final output:\n")
			console.log(ffconcat)
	   }else{
		   //default output - Json array
			o_out_files["data"] = JSON.stringify(all_files);//outputs MUST NOT BE OBJECT! 
			console.log("Final output:",all_files)
	   }
	   
	   
       
       console.log("Writing output file");
	   write_output();
	});	
}
//findfiles

function filter_size(list){
	console.log("filter_size, skip_size_operator:",skip_size_operator,"skip_size_val:",skip_size_val)
	if ((skip_size_operator == ">" && skip_size_val == -1) || skip_size_val == ""){
		console.log("Sizefilter disabled.")
		return list;
	}
	console.log("Sizefilter checking size",skip_size_operator,skip_size_val*1000)
	var new_list = [];
	for (var i=0;i<list.length;i++){
		var size = fs.statSync(list[i]).size;
		var ok = false;
		if (skip_size_operator == ">")
			ok = size*1000 > skip_size_val;
		if (skip_size_operator == "<")
			ok = size*1000 < skip_size_val;
		if (skip_size_operator == ">=")
			ok = size*1000 >= skip_size_val;
		if (skip_size_operator == "<=")
			ok = size*1000 <= skip_size_val;
		if (skip_size_operator == "=")
			ok = size*1000 == skip_size_val;		
		
		console.log("Size filter",ok, list[i],size)
		if (ok)
			new_list.push(list[i])
		
	}
	return new_list;
}

function write_output(){
	
	var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {flags : 'w'});
	outfile.write(JSON.stringify(o_job)) ;
	outfile.close();
    log_file.write("OUTPUT PATH");
    log_file.write(o_job["processor_output_filepath"]);
}

//
//HELPERS
//

function sort_output_array(a_allfiles){
	   console.log("Sorting by",sort_order)
	   if (sort_order.match("Date Created")){
		   console.log("sorting date descending")
		   //sort by date
			a_allfiles = a_allfiles.map(function (fileName){
				return {
				  fullname: fileName,
				  time: fs.statSync(fileName).birthtime.getTime()
				};
			  })
			  .sort(function (a, b) {	
				   return (b.time) - (a.time);
				})
			  .map(function (v) {
				return v.fullname; });
	   }
	   
	   if (sort_order.match("Name")){
			a_allfiles = a_allfiles.sort(function(a, b){
			  return comparer(b.toLowerCase(), a.toLowerCase());
			});
	   }

	   if (sort_order.match("Descending")){
		   return a_allfiles;
	   }
	   
	   return a_allfiles.reverse();
}

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

function format_input_path(what){
    //enusre only forward slashes and a trailing slashes
    //what = what.replace(/\\/g,"/");
    if (!what.match("\\$")){
        what += "\\";
    }
    if (!fs.existsSync(what)) { 
        throw(what + " does not exist");
    }
    return what;
}