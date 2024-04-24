var keysInObject = require('keys-in-object');
var sprintf = require('sprintf-js').sprintf,vsprintf = require('sprintf-js').vsprintf
var fs = require("fs")


//prepare logging 
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
log_file.write("Arguments: " + JSON.stringify(process.argv) + "\n") 

//read input job ticket
let rawdata = fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/, ""); //get rid of UTF8 BOM
log_file.write("JOBTICKET");

let o_job = JSON.parse(rawdata);
console.log(o_job["proc_data"]);

//GET OUTPUTS - make them available as global objects
var output_last_value = filterById(o_job["proc_data"]["outputs"],"output_last_value");
var output_last_code = filterById(o_job["proc_data"]["outputs"],"output_last_code");
console.log("LAST BODY",o_job["proc_data"]["outputs"])

//GET INPUTS // the fields in this object was defined by the index.html which belongs to this processor
var base_url = filterById(o_job["proc_data"]["inputs"], "url")["value"];
console.log("Input url: " + base_url);
var http_method = filterById(o_job["proc_data"]["inputs"], "http_method")["value"].toLowerCase();
console.log("Input http_method: " + http_method);
var request_body = filterById(o_job["proc_data"]["inputs"], "request_body")["value"];
console.log("Input request_body: " + request_body);
var enable_retry = filterById(o_job["proc_data"]["inputs"], "enable_retry")["value"];
console.log("Input enable_retry: " + enable_retry);
var retry_condition = filterById(o_job["proc_data"]["inputs"], "retry_condition")["value"];
console.log("Input retry_condition: " + retry_condition);
var retry_count = filterById(o_job["proc_data"]["inputs"], "retry_count")["value"];
console.log("Input retry_count: " + retry_count);
var retry_delay = filterById(o_job["proc_data"]["inputs"], "retry_delay")["value"];
console.log("Input retry_delay: " + retry_delay);
var enable_polling = filterById(o_job["proc_data"]["inputs"], "enable_polling")["value"];
console.log("Input enable_polling: " + enable_polling);
var polling_frequency = filterById(o_job["proc_data"]["inputs"], "polling_frequency")["value"];
console.log("Input polling_frequency: " + polling_frequency);
var polling_condition_text = filterById(o_job["proc_data"]["inputs"], "polling_condition_text")["value"];
console.log("Input polling_condition_text: " + polling_condition_text);
var a_polling_condition = polling_condition_text.split(",");
console.log("Polling condition array",a_polling_condition);
var headers_commaseparated = filterById(o_job["proc_data"]["inputs"], "http_headers")["value"];
console.log("Input http_headers: " + headers_commaseparated);
var a_http_headers = {};//filled by validate_inputs

validate_inputs(); //checks and formats all inputs
main(); //DO THE WORK

async function main(){
	var response;
	var do_poll = true;
    var do_retry = true;
    var got_error = false;
    var request_count = 0;
	//call the webservice until conditions are met

    while(do_retry||do_poll){
        //first we check if we need to retry, then we check if polling is enabled
        
        do_retry = enable_retry;
        try{	
            response = false;            
            response = await call_rest();
            got_error = false;
        }catch(e){
            console.log("Error calling web service" , e);
            got_error = true;
        }
        request_count++;
        
        if (!response){
            console.log("Error, did not get any response!");
        }
        else if (!"response" in response){
            console.log("Error, got response object but no response information!");
        }
        
        else if (retry_condition.includes(response.response.statusCode.toString())){
            //console.log("No need to retry  ", response.response.statusCode , " is included in allowed per retry condition");
            do_retry = false;
        }
        
        if(do_retry && request_count > retry_count){
            console.log("Error, retry count exhausted, giving up");
            do_retry = false;
            //TODO: end with error
        }
        if (do_retry){
            console.log(request_count + " of " + retry_count + " Detected need to retry, sleeping seconds " + retry_delay  );
            await sleep(retry_delay * 1000);
        }
        
        
        //Polling check 
        
        do_poll = enable_polling;
        if (do_poll){
                if (!got_error){//got some response
                    console.log("Response body: ",response["data"].toString())
                    if (a_polling_condition.length > 0){
                        //polling condition is array
                        for (_idx in a_polling_condition){
                            if ((response["data"]).toString().indexOf(a_polling_condition[_idx]) != -1){
                                console.log("Polling condition '" +polling_condition_text+ "' was met, ending polling");
                                do_poll = false; 
                            }else{
                                console.log("Response did not contain" , a_polling_condition[_idx])                            
                            }
                        }
                    }
                    if (bodyToString(response["data"]).toString().indexOf(polling_condition_text) != -1){
                        //polling condition is text
                        console.log("Polling condition '" +polling_condition_text+ "' was met, ending polling");
                        do_poll = false;
                    }else{
                        console.log("Polling condition not met, going on");
                        if (enable_retry && (do_retry == false)){
                            console.log("Polling detected retry count exhausted, ending polling cycle");
                            do_poll = false;
                        }
                    }
                }else{//got no response
                    console.log("Polling enabled but detected error, checking do_retry is",do_retry)
                    if (!do_retry){
                        console.log("Error, retry is disabled or exhausted, Polling circle ends here.");
                        do_poll = false;
                    }
                }
            }//if do_poll
        
            //if we still need to poll, wait for specified frequency
            if (do_poll){
                console.log("Polling again in " + polling_frequency + " seconds");
                await sleep(polling_frequency*1000);
            }
            await sleep( 1000);
    }//retry while
		
        
        
	
	//end processor
	//decide final exit code
    if (got_error){
        console.log("Last Request returned with error, see logs");
        process.exit(1)
    }
    
	var statuscode = 0;
    var responseBody = "";
    statuscode = response["response"]["statusCode"];
    responseBody = bodyToString(response["data"]);

	console.log("Final response code: " , statuscode);
	console.log("Final response msg: " , responseBody);	
	console.log("Setting outputs")
	output_last_value["data"] = responseBody;
	output_last_code["data"] = statuscode;
	write_output();	
	if (! (statuscode > 199 && statuscode < 300)){
		console.log("Status codes other than 2xx are threated as error");
		process.exit(statuscode);
	}


	
}

//HELPERS 

function bodyToString(what){
//since we disabled all parsers, we always get a buffer object
    return what.toString();	
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}   
async function call_rest(){
	var args = setup_rest_client_args();
	var client = require('node-rest-client-promise').Client(args);
    client.parsers.remove("JSON") //disable automatic parsing
    client.parsers.remove("XML")  //disable automatic parsing
	console.log("Calling:" , base_url);
	var res = await client[http_method+"Promise"](base_url, args); //method name is like getPromise,postPromise etc
	//console.log(res.response.statusCode);
	//console.log(res["data"].toString());
	return res;

}

function setup_rest_client_args(){
	// set content-type header and data as json in args parameter

	var args = {
		data: request_body,
		headers: a_http_headers,
		requestConfig: {
			timeout: 30000, //request timeout in milliseconds
			noDelay: true, //Enable/disable the Nagle algorithm
			keepAlive: true, //Enable/disable keep-alive functionalityidle socket.
			keepAliveDelay: 30000 //and optionally set the initial delay before the first keepalive probe is sent
		},
        mimetypes: {    //this overrides the built in default parsers, we dont want any automatic parsing
            json: ["application/json_parser_disabled"],
            xml: ["application/xml_parser_disabled"]
        }
	};
	
	return args;
	
}

function write_output(){
	
	var outfile = fs.createWriteStream(o_job["processor_output_filepath"], {flags : 'w'});
	outfile.write(JSON.stringify(o_job)) ;
	outfile.close();
    log_file.write("OUTPUT PATH");
    log_file.write(o_job["processor_output_filepath"]);
}

function validate_inputs(){
	if (!enable_retry){
		retry_count = 0;
	}
	
	//parse retry_condition into array
	retry_condition = retry_condition.split(",");
	console.log("retry_condition",retry_condition);
	
	//parse http headers into json object
	if (headers_commaseparated != ""){
	var a_temp = headers_commaseparated.split(",");
		for (i=0;i<a_temp.length;i++){
			var m = a_temp[i].match("(.*?):(.*?)$");
			var hdr = {}
			a_http_headers[m[1]] = m[2];
			
		}
	}
    //parse for basic auth credentials in URL and add Authorisation header if needed
	console.log("Parsed http headers from userinput: ",a_http_headers)

	//iterate throuth inputs and set their values, optional json, xml or url encoding
	var _params = {};
	for (var i=0;i<o_job["proc_data"]["inputs"].length;i++){
		var _input = o_job["proc_data"]["inputs"][i];
		if (_input["id"].indexOf("input_parameter_name") != -1){
			//get the index
			var _myRegexp = /(\d+)$/;
			var _rgmatch = _myRegexp.exec(_input["id"]);
			var _corresponding_input = "input_parameter_value_" +_rgmatch[1];
            
			//search in all input parameter objects for corresponding textbox that carries parameter value
			var _in_val_value = filterById(o_job["proc_data"]["inputs"], _corresponding_input)["value"];
            var _in_val_escaping = filterById(o_job["proc_data"]["inputs"], "input_parameter_escaping_" +_rgmatch[1])["value"]; 
			var _replace = _input["value"];//param name
			console.log("Param Name",_input["id"],"Escaping:",_in_val_escaping,"Escaped ParameterValue",transformParamValue(_in_val_value,_in_val_escaping),"original",_in_val_value)
			var _re = new RegExp(_replace,"g");
			request_body = request_body.replace(_re, transformParamValue(_in_val_value,_in_val_escaping));//replace all names in body by their values
			base_url = base_url.replace(_re, transformParamValue(_in_val_value,_in_val_escaping));
		}

	}
    console.log("request_body",request_body);	
    console.log("base_url",base_url);	

    //finally, after replacing all variables in url and body, check if we have username and password for basic auth in header
    var regexp = "^.*?//(.*?):(.*?)@";
    let result = base_url.match(regexp);
    var basicauth = "";
    if (result){
        if (result.length > 1){
            console.log("Matched username in url, adding auth header",result[1]);
            basicauth += result[1];
            
        }
        if (result.length > 2){
            console.log("Matched password in url, adding auth header",result[2]);
            basicauth += ":" + result[2];
        }
        //only set Auth header if not already set and user&pw present in url
        if (!("Authorization" in a_http_headers) && basicauth != ""){
            a_http_headers["Authorization"] = "Basic " + Buffer.from(basicauth).toString('base64');
            console.log("Final headers:", a_http_headers)
        }
    }
    

}

function transformParamValue(what,how){

	if (how == "url"){
		return encodeURIComponent(what)
	}
	if (how == "json"){
		return escapeJsonChars(what);
	}
	if (how == "xml"){
		return(escapeXml(what))
	}
	return what;
}

//
//HELPERS
//

function escapeJsonChars (what){
    return what.replace(/[\\]/g, '\\\\')
    .replace(/[\"]/g, '\\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');
}


function escapeUrl(what){
	
	return encodeURIComponent(what)
}

function escapeJson(what){
	return JSON.parse(what)
	
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
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
