$input_json = Get-Content -Raw -Encoding UTF8 -Path $args[0] | ConvertFrom-Json

$output = $input_json.proc_data.outputs[0].value #this grabs the user variable entered in the output field

$fullowner = GET-ACL $args[1] | Select -ExpandProperty Owner #the second argument is the source file path
$owner = $fullowner -creplace '^[^\\]*\\', ''

$input_json.proc_data.outputs +=  @{ value = $input_json.proc_data.outputs[0].value ; data = $owner }
$input_json| ConvertTo-Json -depth 100 | Out-File $input_json.processor_output_filepath
$input_json.processor_output_filepath