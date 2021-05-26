# itl-gulpfile
Use with gulp - https://gulpjs.com/ - for uglification and concatenation of project js.
The concatenation of remote files is supported (but without errors handling - @todo). 

The concat order, and the name of bundle-file, can be specified inside the file gulpConfig.js inside source dir.   

Usage:<br />
gulp --source [path_to_source_dir] --destination [path_to_destination_dir]

I.e.:<br />
gulp --source myDevDir --destination public/javascript