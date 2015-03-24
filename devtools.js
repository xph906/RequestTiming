// DevTools page -- devtools.js
// Create a connection to the background page
var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page"
});

// Listener for message from background page
backgroundPageConnection.onMessage.addListener(function (message) {
	//alert("devtools-page receive message:"+message);
});

// Relay the tab ID to the background page
backgroundPageConnection.postMessage({
    tabId: chrome.devtools.inspectedWindow.tabId,
	info: "Hello Chrome, this is devtools",
	name: "helloMsg"
});

chrome.devtools.network.onRequestFinished.addListener(
	function(request) {
		var url = request.request.url;
		var startTime = new Date(request['startedDateTime']).getTime();
		var totalTime = request.time;
		var timings = request.timings;
		var requestMsgObject = {};
		requestMsgObject['url'] = url;
		requestMsgObject['startTime'] = startTime;
		requestMsgObject['totalTime'] = totalTime;
	
		/*
			timings:
			"blocked": 0,
    		"dns": -1,
    		"connect": 15,
    		"send": 20,
    		"wait": 38,
    		"receive": 12,
    		"ssl": -1,
    		"comment": ""
		*/
		requestMsgObject['blockedTime'] = timings.blocked;
		requestMsgObject['dnsTime'] = timings.dns;
		requestMsgObject['connectTime'] = timings.connect;
		requestMsgObject['sendTime'] = timings.send;
		requestMsgObject['waitTime'] = timings.wait;
		requestMsgObject['receiveTime'] = timings.receive;
		requestMsgObject['sslTime'] = timings.ssl;
		var requestMsg = JSON.stringify(requestMsgObject);
		
		//alert(startTime);
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
		backgroundPageConnection.postMessage({name:"requestMsg", request:requestMsg});	
	});

