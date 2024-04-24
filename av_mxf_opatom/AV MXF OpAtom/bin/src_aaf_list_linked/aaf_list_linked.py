
import aaf2
import sys 
import glob, os
import aaf2.mxf
import json
import argparse
import inspect
#globals 

created_file_count = 0
target_filename = None

# functions

def logprint(what):
    if args.debug:
        print (what)

def find_opatom_files(srcfile):
    dir = os.path.dirname(srcfile)
    logprint("Scanning for files in " + dir)
    #foreach file in directory, get out Materialpackage ID and look if all needed parts of opatom file are there (video/audio)
    for _file in os.listdir(dir):
        logprint ("Processing file " + _file)
        m = None
        try:
            m = aaf2.mxf.MXFFile(os.path.join(dir , _file))
            #logprint(inspect.getmembers(m, predicate=inspect.ismethod))
            for _pkg in (m.packages()):
                if isinstance(_pkg, aaf2.mxf.MXFSourcePackage):
                    logprint("Found SP uid in current file: " + str(_pkg.data["MobID"]))
                    for need_uid in all_sp_uids:
                        if str(_pkg.data["MobID"]) == need_uid:
                            logprint (_file + " was found to belong to our file package")
                            all_sp_uids[need_uid] = os.path.join(dir,_file)
        except Exception as e:
            logprint(e)
            continue
    return
       


        
#MAIN
#commandline arguments
parser = argparse.ArgumentParser(description='Locates linked OPAtom Files, e.g. finds corresponding Audio files to a video file or vice-versa')
parser.add_argument('file', metavar='<Video or Audio OPAtom File>', type=str, help='OPAtom File Video or Audio  (full path)')
parser.add_argument('--debug', help='Enables debugging, example: --debug 1')

args = parser.parse_args()

#validate inputs

if (os.path.isdir(args.file)):
    logprint("Detected directory but you need to input a file:" + args.file)
    sys.exit(1)
elif (os.path.isfile(args.file)):
    logprint("Detected file from userinput: " + args.file)
else:
    print ("You need to provide one File as parameter")

#get out which package id's we need - strategy:

m = None
this_sp_uid = None
all_sp_uids = {}

try:
    logprint("Trying to open " + args.file + " as mxf File")
    m = aaf2.mxf.MXFFile(args.file)
    #logprint (m.dump())
    logprint("Trying to parse all Linked Tracks from file " + args.file)
    for _pkg in (m.packages()):
            if isinstance(_pkg, aaf2.mxf.MXFSourcePackage):
            #get SP id of the current file
                    sp_id = _pkg.data["MobID"]
                    logprint("Found Source Package ID: " + str(sp_id))
                    if this_sp_uid == None:
                        this_sp_uid = str(sp_id)
                        logprint ("Source Package ID of the input file: " + str(sp_id))
            if isinstance(_pkg, aaf2.mxf.MXFMaterialPackage):  
                for slot in _pkg.data["Slots"]:
                    logprint("New Track...")
                    #we want this path: MaterialPackage->Slots[currentindex]->MXFTrack->MXFSequence->Components[0]->SourceID  //where components[0] is type MXFSourceClip
                    #use m.dump() to see available paths
                    #also, we assume that the order of the slots defines the physical track order
                    track_name = m.resolve(slot).data["SlotName"]
                    logprint ("Name of this Track: " + track_name)
                    linked_sp_uid = (m.resolve(m.resolve(m.resolve(slot).data["Segment"]).data["Components"][0]).data["SourceID"])
                    
                    #logprint (linked_name)
                    all_sp_uids[str(linked_sp_uid)] = ""
                    logprint ("SP UID of this Track: " + str(linked_sp_uid))
                   
                    
except Exception as e:
    print("Error parsing mxf file: " + args.file)
    raise(e)



#parse filesystem, analyze files 
find_opatom_files(args.file)

logprint(all_sp_uids)

output_array = []
for entry in all_sp_uids:
    output_array.append(all_sp_uids[entry])
print (output_array)
logprint("Done")