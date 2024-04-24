const fs = require("fs");
const path = require('path')


//all found items
var found_files =[];
var found_folders = [];
var all_files =[]; //contains deleted items

//read input job ticket
let rawdata = fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM

//log_file.write(rawdata);
let o_job = JSON.parse(rawdata);

//GET INPUTS - make them available as global objects
var input_list = filterById(o_job["proc_data"]["inputs"],"source_file");
console.log("Input Source File: ", input_list)
var cache_dir =  filterById(o_job["proc_data"]["inputs"],"cache_dir")["value"];//this is actually work_dir from ffastrans perspecitve, but we use it as ffms2 plugin cache_dir input
console.log("Input Cache_dir: ", cache_dir);
var ffms2 = o_job["cache_dir"] + "\\..\\..\\AVS_plugins\\ffms2\\x64\\ffms2.dll"
var force_32 = o_job["workflow"]["special"]["force_32bit"]
console.log("Input force_32: ", force_32);
if (force_32 == "true"){
    ffms2 = ffms2.replace("x64","x86");
}

//GET OUTPUTS 
var o_output_ffmpeg = filterById(o_job["proc_data"]["outputs"],"ffmpeg_line");
var o_output_avs = filterById(o_job["proc_data"]["outputs"],"avs_source");
var o_output_filelist = filterById(o_job["proc_data"]["outputs"],"output_filelist");

console.log("o_output_avs",o_output_avs)

//Execute
var createaaf = process.execPath.replace("node.exe","../aaf_list_linked.exe");
var aafcmd = '"'+createaaf+'"' + "  " + '"' + input_list.value + '"';
console.log("Executing: " + aafcmd)
const exec = require("child_process").execSync;
var result = exec(aafcmd);
console.log("Result from process:" +result);
result = result.toString().replace(/'/g,"\"");
o_output_filelist.data = result;
process_output(result+"");
create_avs(result+"");
write_output();


function create_avs(s_filearray){
    var filelist = JSON.parse(s_filearray);
    var s_avs = 'LoadCPlugin("'+ffms2+'")\n';
    var mergechannels = "";
    for (var _idx = 0; _idx<filelist.length;_idx++){
        var fname = path.parse(filelist[_idx]).name;
        console.log("Parsed fname", fname)
        if (_idx == 0){
            s_avs += 'VIDEO = FFVideoSource("'+ filelist[_idx] +'", 0, cachefile = "' + cache_dir + fname + '.ffindex", seekmode = 0)\n';

        }else{
            s_avs += 'A_'+ _idx +' = FFAudioSource("'+ filelist[_idx] +'",cachefile = "' + cache_dir + fname + '.ffindex")\n';
            mergechannels += 'A_'+ _idx;
        }
        if (_idx != filelist.length-1 && _idx != 0){
            mergechannels += ","
        }
        
    }
    if (filelist.length > 1){
        s_avs += 'AUDIO = mergechannels(' + mergechannels + ")\n";
        s_avs +=  "audiodub(VIDEO,AUDIO)\n";
    }
    s_avs += "m_clip = last\n";
    s_avs += "Return m_clip\n";
    console.log("Generated avs script:");
    console.log(s_avs);
    console.log("Writing avs file to " + cache_dir + "\\opatom_source.avs")
    fs.writeFileSync(cache_dir + "\\opatom_source.avs" ,s_avs);
    o_output_avs.data = cache_dir + "\\opatom_source.avs";
    console.log("Setting output:" , o_output_avs);
}

//create ffmpeg line
function process_output(s_filearray){
    var filelist = JSON.parse(s_filearray);
    console.log("Parsed filelist:",filelist);
    var ffmpeg_line = '';
    var map_line = "";
    for (var _idx = 0; _idx<filelist.length;_idx++){
        ffmpeg_line += " -i " + '"' +filelist[_idx] + '"';
        map_line += " -map " + _idx;
    }
    
    o_output_ffmpeg.data = ffmpeg_line + map_line;
    console.log("Final ffmpeg output obj:", o_output_ffmpeg);
    
}
//END

function write_output(){
	var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {flags : 'w'});
	outfile.write(JSON.stringify(o_job)) ;
	outfile.close();
}

function filterById(array, string) {
//finds by key in input variable array
    for (idx in array){
        if (array[idx].id == string){
            return array[idx];
        }
    }
}
