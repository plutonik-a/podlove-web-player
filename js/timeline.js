/*
[
 {type: "image", "title": "The very best Image", "url": "http://domain.com/images/test1.png"},
 {type: "shownote", "text": "PAPAPAPAPAPAGENO"},
 {type: "topic", start: 0, end: 1, q:true, title: "The very first chapter" },
 {type: "audio", start: 0, end: 1, q:true, class: 'speech'},
 {type: "audio", start: 1, end: 2, q:true, class: 'music'},
 {type: "audio", start: 2, end: 3, q:true, class: 'noise'},
 {type: "audio", start: 4, end: 5, q:true, class: 'silence'},
 {type: "content", start: 0, end: 1, q:true, title: "The very first chapter", class:'advertisement'},
 {type: "location", start: 0, end: 1, q:false, title: "Around Berlin", lat:12.123, lon:52.234, diameter:123 },
 {type: "chat", q:false, start: 0.12, "data": "ERSTER & HITLER!!!"},
 {type: "shownote", start: 0.23, "data": "Jemand vadert"},
 {type: "image", "name": "The very best Image", "url": "http://domain.com/images/test1.png"},
 {type: "link", "name": "An interesting link", "url": "http://"},
 {type: "topic", start: 1, end: 2, "name": "The very first chapter", "url": ""},
]
 */
var tc = require('./timecode');

/**
 *
 * @param {HTMLMediaElement} player
 * @param {object} data
 * @constructor
 */
function Timeline(player, data) {
  this.player = player;
  this.hasChapters = checkForChapters(data);
  this.data = this.parseSimpleChapter(data);
  this.modules = [];
  this.listeners = [logCurrentTime];
  this.currentTime = -1;
  this.duration = data.duration;
}

module.exports = Timeline;

Timeline.prototype.addMetadata = function (data) {
  var parsed = _parse(data);
  this.data = _merge(this.data, parsed);
};

Timeline.prototype.getData = function () {
  return this.data;
};

Timeline.prototype.getDataByType = function (type) {
  return this.data.filter(_filterByType(type));
};

Timeline.prototype.addModule = function (module) {
  if (module.update) {
    this.listeners.push(module.update);
  }
  this.modules.push(module);
};

Timeline.prototype.update = function(event) {
  function call (i, listener) {
    listener(player);
  }
  console.log('Timeline', 'update', event);
  var player = event.currentTarget,
    rewind = (this.currentTime > player.currentTime),
    start = this.currentTime,
    end = player.currentTime;

  if (rewind) {
    start = end;
    end = this.currentTime;
  }
  this.emitEventsBetween(start, end);
  $.each(this.listeners, call);
};

Timeline.prototype.emitEventsBetween = function (start, end) {
  var emitStarted = false,
    emit = function (event) {
      var customEvent = new CustomEvent("timelineElement", event);
      this.player.dispatchEvent(customEvent);
    }.bind(this);
  this.data.map(function (event) {
    var later = (event.start > start),
      earlier = (event.end < start),
      ended = (event.end < end)
      ;
    if (later && earlier && !ended || emitStarted) {
      emit(event);
    }
    emitStarted = later;
  });
};

function _filterByType (type) {
  return function (record) {
    return (record.type === type);
  }
}

/**
 *
 * @param {HTMLElement} player
 */
function logCurrentTime (event) {
  console.log('Timeline', 'currentTime', event.currentTime);
}

/**
 *
 * @param {object} params
 * @returns {boolean} true if at least one chapter is present
 */
function checkForChapters(params) {
  return !!params.chapters && (
    (typeof params.chapters === 'string' && params.chapters.length > 10) ||
      (typeof params.chapters === 'object' && params.chapters.length > 1)
    );
}

function _parse (data) {
  return data;
}

function _merge (a, b) {

}

Timeline.prototype.parseSimpleChapter = function (data) {
  var chapters = typeof data.chapters === 'string'
    ? data.chapters.split("\n").map(chapterFromString)
    : data.chapters.map(transformChapter);

  // order is not guaranteed: http://podlove.org/simple-chapters/
  return chapters
    .map(addType('chapter'))
    .map(addEndTime(data.duration))
    .sort(function (a, b) {
    return a.start - b.start;
  });
}

function transformChapter (chapter) {
  chapter.code = chapter.title;
  if (typeof chapter.start === 'string') {
    chapter.start = tc.getStartTimeCode(chapter.start);
  }
  return chapter;
}

function chapterFromString (chapter) {
  var line = $.trim(chapter);
  //exit early if this line contains nothing but whitespace
  if (line === '') {
    return {};
  }
  //extract the timestamp
  var parts = line.split(' ', 2);
  var tc = tc.getStartTimeCode(parts[0]);
  var title = $.trim(parts[1]);
  return { start: tc, code: title, title: title };
}

/**
 * add `end` property to each simple chapter,
 * needed for proper formatting
 * @param {Array} chapters
 * @param {number} duration
 * @returns {function}
 */
function addEndTime(duration) {
  return function (chapter, i, chapters) {
    var next = chapters[i + 1];
    chapter.end = next ? next.start : duration;
    return chapter;
  };
}

function addType(type) {
  return function(element) {
    element.type = type
    return element;
  };
}