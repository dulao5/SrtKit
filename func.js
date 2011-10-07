
function prepare() {
	document.getElementById('prepare').style.display = 'none';
	var supported = (window.File && window.FileReader && window.FileList && window.Blob) && (window.requestFileSystem || window.webkitRequestFileSystem);
	if(!supported) {
		document.getElementById('support').style.display = 'block';
	}
	else {
		document.getElementById('main').style.display = 'block';
		switchToPanel('upload');
	}
}

//read files to doc var
/*  required : global var : doc */
function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // Loop through the FileList and render image files as thumbnails.
    for (var i = 0, f; f = files[i]; i++) {

      // Only process image files.
      console.log(f.type);

      var reader = new FileReader();

      // Closure to capture the file information.
      reader.onload = (function(theFile) {
        return function(e) {
          doc.name = theFile.name ;
	  doc.content = e.target.result;
	  switchToPanel('adjust');
	  document.getElementById('span_filename').innerHTML = doc.name;
        };
      })(f);

      // Read in the file as Text -utf-8.
      reader.readAsText(f);
    }
}

function handleDo() {
	var offset = parseFloat(document.getElementById('offset').value);
	if(isNaN(offset)) {
		document.getElementById('error').style.display = 'block';
		document.getElementById('offset').focus();
		return;
	}
	var newContent = adjustSrtTime(doc.content, offset);
	outputToFile(doc.name, newContent, function(url, error){
		if(!url) {
			alert(error);
			return;
		}

		var a = document.createElement('a');
		a.setAttribute('href', url);
		a.innerHTML = doc.name;
		document.getElementById('result_span').innerHTML = '';
		document.getElementById('result_span').appendChild(a);
		switchToPanel('result');
	});
}

function switchToPanel(name) {
	document.getElementById('adjust').style.display = 'none';
	document.getElementById('upload').style.display = 'none';
	document.getElementById('result').style.display = 'none';
	document.getElementById(name).style.display = 'block';
}

//adjust srt timings
//match 00:02:04,237 --> 00:02:08,037 line
//replace line
function adjustSrtTime(content, offset) {
	content = content.replace(/\r\n/g, '\n');
	content = content.replace(/\r/g, '\n');
	content = content.replace(/\n/g, '\r\n');
	var lines = [];
	var s = new LineStream(content);
	var reg = /^((\d\d+):(\d\d):(\d\d),(\d+))\s+-->\s+((\d\d+):(\d\d):(\d\d),(\d+))\s*$/;
	while(!s.eof) {
		var line = s.gets();
		var m = reg.exec(line);
		if(m !== null) {
			var b = makeTime(m[2], m[3], m[4], m[5]);
			var e = makeTime(m[7], m[8], m[9], m[10]);
			b = b + offset;
			e = e + offset;

			if(b > 0 || e > 0) {
				line = formatTime(b) + ' --> ' + formatTime(e) + '\r\n';
			}
		}
		lines.push(line);
	}
	return lines.join('');
}

//sec to H:i:s,ms
function formatTime(t) {
	var h = Math.floor(t / (60 * 60));
	h = (h<10) ? ("0"+h) : (""+h);
	var i = Math.floor(t / 60) % 60;
	i = (i<10) ? ("0"+i) : (""+i);
	var s = Math.floor(t % 60);
	s = (s<10) ? ("0"+s) : (""+s);
	var ms = Math.floor(t * 1000) % 1000;
	ms = (ms<10) ? ("00"+s) : ((ms<100)? ('0'+ms) : (""+ms));
	return h+":"+i+":"+s+','+ms ;
}

//H:i:s,ms to time sec
function makeTime(h, i, s, ms) {
	return parseInt(h, 10) * 60 * 60 
		+ parseInt(i, 10) * 60
		+ parseInt(s, 10) 
		+ parseInt(ms, 10) / 1000 ;
}

//output to file
//return uri of out file
//call: onInitFs -> readEntries -> removeEntries -> createFile -> callback
function outputToFile(filename, content, callback) {
	function errorHandler(e) {
	  var msg = '';

	  switch (e.code) {
	    case FileError.QUOTA_EXCEEDED_ERR:
	      msg = 'QUOTA_EXCEEDED_ERR';
	      break;
	    case FileError.NOT_FOUND_ERR:
	      msg = 'NOT_FOUND_ERR';
	      break;
	    case FileError.SECURITY_ERR:
	      msg = 'SECURITY_ERR';
	      break;
	    case FileError.INVALID_MODIFICATION_ERR:
	      msg = 'INVALID_MODIFICATION_ERR';
	      break;
	    case FileError.INVALID_STATE_ERR:
	      msg = 'INVALID_STATE_ERR';
	      break;
	    default:
	      msg = 'Unknown Error';
	      break;
	  };

	  console.log('Error: ' + msg);
	}
	function onInitFs(fs) {
		//funcs
		function removeEntries(entries, nextstep) {
			entries.forEach(function(entry, i) {
				entry.remove(function(){}, function(e){console.log(e);});
			});
			nextstep.call();
		}

		function createFile() {
			  fs.root.getFile(filename, {create: true}, function(fileEntry) {

			    // Create a FileWriter object for our FileEntry (log.txt).
			    fileEntry.createWriter(function(fileWriter) {

			      fileWriter.onwriteend = function(e) {
				console.log('Write completed.');
				callback(fileEntry.toURL());
			      };

			      fileWriter.onerror = function(e) {
				console.log('Write failed: ' + e.toString());
				callback(false, e);
			      };

			      // Create a new Blob and write it to file.
			      var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;	
			      var bb = new BlobBuilder(); // Note: window.WebKitBlobBuilder in Chrome 12.
			      bb.append(content);
			      fileWriter.write(bb.getBlob('text/plain'));

			    }, errorHandler);

			  }, errorHandler);
		}

	  // remove old files ------------begin---

	  var dirReader = fs.root.createReader();
	  var entries = [];

	  // Call the reader.readEntries() until no more results are returned.
	  var readEntries = function() {
	     dirReader.readEntries (function(results) {
	      if (!results.length) {
		removeEntries(entries.sort(), createFile);
	      } else {
		entries = entries.concat(Array.prototype.slice.call(results || [], 0));
		readEntries();
	      }
	    }, errorHandler);
	  };

	  readEntries(); // Start reading dirs.
	  // remove old files ------------begin---
	}

	var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
	requestFileSystem(window.TEMPORARY, 1024*1024, onInitFs, errorHandler);
}


//class LineStream
function LineStream(content, lineBreak/* \r\n */) {
	this.lineBreak = !lineBreak ? '\r\n' : ("" + lineBreak);
	if('' === this.lineBreak) throw new Error('LineStream : invalid lineBreak');
	this.content = "" + content;
	this.eof = false;
	this.offset = 0;
}
LineStream.prototype.gets = function ()	{
	if(this.eof) throw new Error("LineStream eof");

	var idx = this.content.indexOf(this.lineBreak, this.offset);
	if(idx == -1) {
		this.eof = true;
		return this.content.substring(this.offset);
	}
	else {
		idx = idx + 2; //include '\r\n'
		var r = this.content.substring(this.offset, idx);
		this.offset = idx;	
		return r;
	}
}
