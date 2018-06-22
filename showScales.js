$(document).ready(function(){ go(); });

// tunings as notes on each string
var tuning4ths = [28, 23, 18, 13, 8, 3];
var tuningStandard = [28, 23, 19, 14, 9, 4];

var stringOffsets = tuning4ths;
var majorScale = [0, 2, 4, 5, 7, 9, 11];

var scales = [
	['Major', [0, 2, 4, 5, 7, 9, 11]],
	['Lydian', [0, 2, 4, 6, 7, 9, 11]],
	['Mixolydian', [0, 2, 4, 5, 7, 9, 10]],
	['Melodic Minor', [0, 2, 3, 5, 7, 9, 11]],
	['Lydian ♭7', [0, 2, 4, 6, 7, 9, 10]],
	['Locrian ♮2', [0, 2, 3, 5, 6, 8, 10]],
	['Altered', [0, 1, 3, 4, 6, 8, 10]],
	['1-2-3-5', [0, 2, 4, 7]]
];

var patternScaleUp = [1];
var patternScaleDown = [-1];

// array of booleans that show which roots are available for choice
var availableRoots = [];

var basicScale = scales[0][1];

var noteNames = [
	['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
	['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
	];
	
var minFret = 4;
var minNote = 0;
var maxNote = 0;

// specify how the scale needs to be transposed
// var scaleTranspositionSequence = [2, 2, 1, 2, 2, 2, 1];
// transpose the scale after these many notes
var transposeEveryHowManyNotes = 4;

var formNotesPerMinute;

var isPause = true;

var synth = new Tone.Synth({
	"oscillator" : {
		type:"sine",
		frequency:440,
		detune:0,
		phase:0,
		partials: [0.03, 0.01, 0.01],
	},
	"envelope" : {
		"attack" : 0.02,
		"decay" : 0.4,
		"sustain" : 0.4,
		"release" : 1.9,
	}
}).toMaster();

var setMinFret = function(val) {
	minFret = val;
	minNote = minFret + stringOffsets[5];
	// max note depends on the tuning
	var range = stringOffsets[0] - stringOffsets[5] + 4;
	maxNote = minNote + range
};

var sleep = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// transpose the passed scale of the needed steps (positive number)
var transposeScale = function(scale, steps){
	var newScale = scale.map(function(i){ return (i + steps) % 12; });
	
	newScale = newScale.sort((a, b) => a - b);
	
	return newScale;
};

// return jQuery element with the needed label and text field
var getFormElement = function(label, fieldId, size, defaultValue){
	var out = {};
	
	out.domDiv = $('<div/>').addClass('formField');
	out.val = defaultValue;
	out.displayValue = $('<span/>').text(out.val);
	
	out.domDiv
		.append($('<span/>').addClass("formLabel").text(label))
		.append(out.displayValue)
		.append($('<button>').html("&uarr;").click(function(){ out.val++; out.displayValue.text(out.val); }))
		.append($('<button>').html("&darr;").click(function(){ out.val--; out.displayValue.text(out.val); }));
		
	return out;
};

// add checkboxes to select what roots are available
var getRootSelector = function(){
	var tab = $('<table/>');
	var row = $('<tr/>');
	row.append($('<td/>').text('Available roots: '));
	for (var i = 0; i < 12; i++){
		availableRoots[i] = true;
		var cb = $('<input/>').attr({ type: 'checkbox'}).prop('checked', true).data('noteNum', i);
		// change value of underlying array when clicked
		cb.change(function(){
			var noteNum = $(this).data('noteNum');
			availableRoots[noteNum] = this.checked;
			console.log('modified root ' + noteNum + ' to ' + this.checked);
		});
		row.append($('<td/>').append(noteNames[0][i]).append(cb));
	}
	tab.append(row);
	return tab;
}

var buildUI = function(diagram){
	buildFretboard(diagram);
	
	// add start / pause button
	diagram.append($('<div/>').addClass('formField').append($('<button/>').addClass('startPause').text('Start / Pause').click(function(){ isPause = !isPause; })));
	
	diagram.append(getRootSelector);
	
	formNotesPerMinute = getFormElement('Notes per minute', 'notesPerMinute', 3, 100);
	diagram.append(formNotesPerMinute.domDiv);
	
	// add selector of minimum fret
	var minFretSelect = $('<select/>');
	for (var i=1; i < 12; i++){
		var option = $('<option/>').val(i).text(i);
		if (i == 4) {
			option.prop('selected', true);
		}
		minFretSelect.append(option);
	}
	minFretSelect.change(function(){
		setMinFret(parseInt(minFretSelect.val()));
		selectActiveFrets();
	});
	$('#minFret').append(minFretSelect);
	
	// add scale selector
	var scaleSelector = $('<select/>');
	$.each(scales, function(i, scale){
		var option = $('<option/>').val(i).text(scale[0]);
		scaleSelector.append(option);
	});
	// change scale values when a new entry is selected
	scaleSelector.change(function(){
		var selected = scaleSelector.find(':selected').val();
		basicScale = scales[selected][1];
	});
	$('#scaleSelector').append('Scale: ').append(scaleSelector);
	
};

// build fretboard on the page
var buildFretboard = function(diagram){
	var fretboard = $('<table/>').attr({id: 'fretboard'});
	for (var string = 0; string < 7; string++){
		var tr = $('<tr/>');
		for (var fret = 0; fret < 16; fret++){
			var td;
			if (string < 6){
				var note = (stringOffsets[string] + fret);
				td = $('<td/>').addClass('fret').addClass('fret' + fret).addClass('n' + note);
				if (fret != 0){
					td.addClass('nv' + (note%12));
				}
			} else {
				// add the fret number
				td = $('<td/>').addClass('fretName');
				if ($.inArray(fret, [3,5,7,9,12,15]) >= 0) {
					td.text(fret)
				} else {
					td.addClass('fret0');
				}
			}
			tr.append(td);
		}
		fretboard.append(tr);
	}
	
	diagram.append(fretboard);
};

// show selected scale on the fretboard, or just remove the current
// one if no scale is passed
var setFretboardScale = function(scale){
	// clear
	$('td').removeClass('noteScale');
	// select notes for current scale
	
	if (scale){
		for (var i = 0; i < scale.length; i++){
			$('td.nv' + scale[i]).addClass('noteScale');
		}
	}
};

// return the absolute position of the closest note in the scale
var findNoteInScale = function(note, scale, direction){
	var noteInOctave = note % 12;
	var octave = Math.floor(note / 12);
	
	// default to last note in octave below
	var prevNote = -1;
	// default to first note in octave above
	var nextNote = scale.length;
	
	for (var i = 0; i < scale.length; i++){
		var val = scale[i];
		if (val <= noteInOctave && i > prevNote) { prevNote = i; }
		if (val >= noteInOctave && i < nextNote) { nextNote = i; }
	}	
	
	var scaleNote = 0;
	if (prevNote == nextNote){
		// the note is in the scale
		scaleNote = prevNote;
	} else if (direction == 1){
		// going up
		scaleNote = nextNote;
	} else {
		// going down
		scaleNote = prevNote;
	}
	
	var outNote = scaleNote + octave * scale.length;
	
	return outNote;
};

// get element array keeping the index in the bounds
var getArrayElement = function(inArray, inNum){
	return inArray[inNum % inArray.length];
};

var computeNote = function(pattern, i, scale, noteInScaleAbsolute){	
	var out = {};
	
	// get pattern step if a patter is passed, otherwise zero
	out.patternStep = (pattern) ? getArrayElement(pattern, i) : 0;		
	out.noteInScaleAbsolute = noteInScaleAbsolute + out.patternStep;	
	out.octave = Math.floor(out.noteInScaleAbsolute / scale.length);
	out.noteValuePosition =out.noteInScaleAbsolute % scale.length;		
	out.note = scale[out.noteValuePosition] + out.octave * 12;
	
	//console.log("pattern " + pattern + ", i: " + i + ", scale: " + scale + ", noteAbs: " + noteInScaleAbsolute);
	
	return out;
};

// pick a random root and compute the scale
var getNextScale = function(scale, prevScale){
	var out = {};
	// random root
	out.root = Math.floor(Math.random() * 12);
	
	// keep looping unting you get a different one
	if (prevScale){
		while (prevScale.root == out.root || !availableRoots[out.root]) {
			out.root = Math.floor(Math.random() * 12);
		}
	}	

	out.rootName = noteNames[Math.round(Math.random())][out.root];
	out.scale = transposeScale(scale, out.root);
	
	return out;
};

// ##########
// main loop
// walk through the scale with the given pattern
async function showNotes(patternUp, patternDown){
	var previousFrets;
	
	// get current and next scale becase we need to show them both on the UI
	var currentScale = getNextScale(basicScale);
	var nextScale = getNextScale(basicScale);
	
	// show the root
	// show the new root
	$("td.nv" + currentScale.root).html(currentScale.rootName);
	
	// position in the scale, e.g. 1=C, 2=D, 7=B, 8=C next octave
	var noteInScaleAbsolute = findNoteInScale(minNote, currentScale.scale, 1);
	var pattern = patternUp;
	
	var wellTemperedRatio = Math.pow(2, 1/12);
	var frequencyC = 110 * Math.pow(wellTemperedRatio, 3);
	
	setFretboardScale(currentScale.scale);
	
	var i = 0;
	while (true) {
		$('#current').html("Current: " + currentScale.rootName);
		$('#next').html("Next: " + nextScale.rootName);
		$('#counter').html("Counter: " + (1 + i % transposeEveryHowManyNotes) + "/" + transposeEveryHowManyNotes);
		
		while (isPause){
			await sleep(100);
		}		
		
		// assume note is correct, compute and show
		var currentNote = computeNote(null, i, currentScale.scale, noteInScaleAbsolute);		
		noteInScaleAbsolute = currentNote.noteInScaleAbsolute;
		
		// remove previous highlight if any
		if (previousFrets){
			previousFrets.removeClass('hl');
		}
		
		// display note
		var frets = $('td.n' + currentNote.note);		
		frets.addClass('hl');
		previousFrets = frets;
		
		// play note
		var freq = frequencyC * Math.pow(wellTemperedRatio, currentNote.note);		
		synth.triggerAttackRelease(freq, '8n')		
		
		await sleep(1000 * 60 / formNotesPerMinute.val);		
		
		// compute next 
		i++;
		
		// check if we need to pass to the next scale
		if (i % transposeEveryHowManyNotes == 0){
			// remove dots for current root
			$("td.nv" + currentScale.root).html("");
	
			// next becomes current, and compute new next
			currentScale = nextScale;
			nextScale = getNextScale(basicScale, currentScale);
			
			// reset the absolute not in relation to the new scale
			// 1) if note falls in the new scale => nothing happens
			// 2) if the note falls outside the new scale => use the direction opposite to the next step
			//       to make sure we don't skip more than needed			
			var direction = -Math.sign(getArrayElement(pattern, i));
			noteInScaleAbsolute = findNoteInScale(currentNote.note, currentScale.scale, direction);
			
			// show the new root
			$("td.nv" + currentScale.root).html(currentScale.rootName);
			
			if ($('#showScale').is(":checked")) {
				setFretboardScale(currentScale.scale);
			} else {
				setFretboardScale();
			}
		}
		
		var nextNote = computeNote(pattern, i, currentScale.scale, noteInScaleAbsolute);		
		
		// switch pattern if needed
		if (nextNote.note > maxNote) {
			pattern = patternDown;
			nextNote = computeNote(pattern, i, currentScale.scale, noteInScaleAbsolute);
		} else if (nextNote.note < minNote) {
			pattern = patternUp;
			nextNote = computeNote(pattern, i, currentScale.scale, noteInScaleAbsolute);
		}
		
		noteInScaleAbsolute = nextNote.noteInScaleAbsolute;
	}
};

// select the frets that are going to show the note
var selectActiveFrets = function(){
	// clean up
	$('.fret').removeClass('activeFret');
	// width of 5 does overlap, but it solves issues with 
	// certain cases that otherwise would have 2 notes per string	
	var width = 4;
	for (var i = minFret; i <= minFret + width; i++){
		$('.fret' + i).addClass('activeFret');
	}
};

// main go when page ready
var go = function(){
	console.log('go');
	var diagram = $('#diagram');
	buildUI(diagram);
	selectActiveFrets();
	//setFretboardScale(scale);
	// start from lowest note in the active frets
	setMinFret(4);
	showNotes(patternScaleUp, patternScaleDown);
};