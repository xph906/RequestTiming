// Content script -- contentscript.js

var backgroundPageConnection = chrome.runtime.connect({name: "content-page"});
backgroundPageConnection.postMessage({name:"helloMsg",info:"Hello Chrome, this is content script"});
var DOMContentLoadedTime = 0;
var loadTime = 0;

var DOMContentLoadedListener = function(event){
	var currentTime = new Date().getTime();
	console.log("DOMContentLoadedEvent:"+currentTime);
	DOMContentLoadedTime = currentTime;
	var url = document.URL;
	backgroundPageConnection.postMessage({name:"eventTimeMsg",eventName:"DOMContentLoaded",time:String(currentTime),url:url});
	//alert("DOMContentLoadedEvent:"+url);
}

var LoadListener = function(event){
	var currentTime = new Date().getTime();
	var url = document.URL;
	console.log("LoadEvent:"+currentTime);
	loadTime = currentTime;
	backgroundPageConnection.postMessage({name:"eventTimeMsg",eventName:"load",time:String(loadTime),url:url,path:getURLPath(url),host:getURLHost(url)});
	console.log("URL:"+url+" PATH:"+getURLPath(url));
}


function getURLPath(url){
  var a = document.createElement('a');
  a.href = url;
  return a.pathname;
}

function getURLHost(url){
  var a = document.createElement('a');
  a.href = url;
  return a.host;
}

/*
chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
    var url = tabs[0].url;
	
});
*/

window.addEventListener("DOMContentLoaded",DOMContentLoadedListener);
window.addEventListener("load",LoadListener);
