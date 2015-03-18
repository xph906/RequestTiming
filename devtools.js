// DevTools page -- devtools.js
// Create a connection to the background page
var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page"
});

backgroundPageConnection.onMessage.addListener(function (message) {
	//alert("devtools-page receive message:"+message);
});

// Relay the tab ID to the background page
backgroundPageConnection.postMessage({
    tabId: chrome.devtools.inspectedWindow.tabId,
    scriptToInject: "content_script.js"
});

chrome.devtools.network.onRequestFinished.addListener(
	function(request) {
		var url = request.request.url;
		var startTime = request.startedDateTime;
		/*chrome.devtools.network.getHAR(
			function (harLog) {
				//alert(harLog.entries.length);
				for(var i=0; i < harLog.entries.length; i++){
					var log = harLog.entries[i];
					var length = harLog.entries.length;
					var url = log.request.url;
					var startTime = log.startedDateTime;
					//alert(url+startTime);
					backgroundPageConnection.postMessage({len:length, url:url, startTime:startTime});
				}
			});
		*/
		backgroundPageConnection.postMessage({url:url, startTime:startTime,request:request});	
	});

