##########
#   Example FFAStrans Plugin Processor 
#       This script shows all possible interactions with FFASTrans engine
#       Depending on the node.json config, this could also be an .exe in any programming language or any other script language
#       Testing: Uncomment the writing to c:\temp\plugin_prop_input.json - execute the processor once and then on commandline, test your script this way:
#               powershell.exe -ExecutionPolicy Unrestricted -File  "C:\path-to\thisscript.ps1" "c:\temp\plugin_prop_input.json"
##########

#Write Message to Log
    Write-Output "Starting up"

#read input JSON file

    $input_json = Get-Content -Raw -Encoding UTF8 -Path $args[0] | ConvertFrom-Json
    ### $input_json| ConvertTo-Json -depth 100 | Out-File "c:\temp\plugin_prop_input.json" # writes input json to file for develpment
    $all_inputs = $input_json.proc_data.inputs
    $all_outputs = $input_json.proc_data.outputs

#get individual input values - the input "id's" are known to you because you defined them in index.html
    $file_to_wait              = ($all_inputs | where { $_.id -eq "fullpath" }).value
    #Write-Output "Value of input file_to_wait: "$file_to_wait 
    $del_on_cancel              = ($all_inputs | where { $_.id -eq "delete_on_cancel" }).value
    #Write-Output "Value of input delete on cancel: "$del_on_cancel   

#at this point, the processor shall do its work. We simulate some work by sleeping and report progress
        $directory = Split-Path -Path $file_to_wait 
        #Write-Output "Search path: "$directory
        $oldestfile = ""
        try{
        
                while($oldestfile -ne $file_to_wait ){
                    $oldestfile = dir $directory | sort lastwritetime | select -First 1  | select -expand FullName
                    $nameonly = Split-Path -Leaf $file_to_wait
                    Write-Output "Waiting for "$nameonly" to be oldest"
                    Start-Sleep -Milliseconds 1000  
                    if (-not (Test-Path $file_to_wait)){
                        Write-Output $file_to_wait" did not exist exiting!"
                        exit 1
                    }
                }
                
           }
        finally{
            #Write-Output "Finally"
            Set-Content -Path 'C:\temp\cancelled.txt' -Value 'test string'
            if ($oldestfile -eq $file_to_wait){
                Write-Output $oldestfile" was found to be the oldest file, done."
            }else{
                if ($del_on_cancel -and (Test-Path $file_to_wait)){
                    #Write-Output "Cancel detected, deleting source"
                    Remove-Item -Path $file_to_wait
                }
            }
            
        }
