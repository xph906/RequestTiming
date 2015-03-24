// Background page -- background.js

var bg = chrome.extension.getBackgroundPage();
function URLElements(){
    this.requests = [];
    this.DOMContentLoadedTime = 0;
    this.loadTime = 0;
}
var elements = new URLElements();
var urlTable = {}

function iterateProperties(obj){
    bg.console.log("Object Properties:");
    for(var item in obj){
        bg.console.log(item+" "+Object.prototype.toString.call(item));
    }
    bg.console.log();
}
function objToString (obj) {
    var str = '';
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            str += p + '::' + obj[p] + '\n';
        }
    }
    return str;
}

var devToolsListener = function(message, sender, sendResponse) {
    //chrome.tabs.executeScript(message.tabId,{ file: message.scriptToInject });
    //iterateProperties(message.startTime);
    if(message.name == "requestMsg"){
        var request = JSON.parse(message.request);
        //bg.console.log("[devtools] receive request msg "+message.request);
        elements.requests.push(request);
    }
    else if(message.name == "helloMsg"){
        bg.console.log("[devtools] receive hello msg: "+message.info);
    }
    else{
        bg.console.log("[devtools] receive unknown msg from "+sender+": "+message.name);
    }  
    //sender.postMessage({name:"response msg abcde"});
}

function compareRequestStartTime(reqA, reqB){
    return reqA.startTime - reqB.startTime;
}

function compareRequestEndTime(reqA, reqB){
    return reqA.endTime - reqB.endTime;
}

var contentScriptListener = function(message, sender, sendResponse) {
    if(message.name == "helloMsg"){
        bg.console.log("[contentscript] receive hello msg from tab: "+message.info);
    }
    else if(message.name=="eventTimeMsg"){
        bg.console.log("[contentscript] "+message.eventName+":"+message.time);
        if(message.eventName=="DOMContentLoaded"){
            elements.DOMContentLoadedTime = parseInt(message.time);
            //bg.console.log("onload event gets fired: received:"+elements.requests.length+" requests");
        }
        else if(message.eventName=="load"){
            var url = message.url;
            elements.loadTime = parseInt(message.time);
            bg.console.log("onload event gets fired: received:"+elements.requests.length+" requests");
            if(elements.requests.length > 0){
                /*  FIXME: Note that the URL here is not accurate 
                    because it is not the original URL if redirecion happens */
                bg.console.log("  first url:"+url);
                for(var index=0; index<elements.requests.length; index++){
                    if(elements.requests[index].url == url){
                        bg.console.log("  "+index+" request is the url");
                        elements.requests = elements.requests.slice(index);
                        break;
                    }
                }
                console.log("  "+elements.requests.length+" ");
                urlTable[url] = elements;

                /* sort the requests based on start time and end time */
                for(var i in elements.requests){
                    //bg.console.log(elements.requests[i].url+": totaltime:"+elements.requests[i].totalTime);
                    endTime = elements.requests[i].startTime + elements.requests[i].totalTime;
                    elements.requests[i].endTime = endTime;
                }
                var sortedRequestsOnStartTime = elements.requests.slice();
                var sortedRequestsOnEndTime = elements.requests.slice();
                console.log(elements.requests.length+" sortedRequestsOnStartTime len:"+sortedRequestsOnStartTime.length + 
                            " sortedRequestsOnEndTime len:"+sortedRequestsOnEndTime.length);
                sortedRequestsOnStartTime.sort(compareRequestStartTime);
                sortedRequestsOnEndTime.sort(compareRequestEndTime);
                
                /* create a dict to map a request's start time and end time */
                var urlDict = {};
                for(var i in sortedRequestsOnStartTime){
                    var url1 = sortedRequestsOnStartTime[i].url;
                    urlDict[url1] = [i];
                    urlDict[url1]
                    for(var j in sortedRequestsOnEndTime){
                        var url2 = sortedRequestsOnEndTime[j].url;
                        if(url1 == url2){
                            urlDict[url1].push(j);
                            break;
                        }
                    }
                    if(urlDict[url1].length != 2){
                        console.log("error "+url1+": cannot find ending time");
                    }
                }

                /* Calculate the degree of each request (dependecy) and store it into sortedRequestsOnEndTime.
                 * We assume that request A depends on request B if and only if A's startTime is larger than B's 
                 * endTime and there is no request C whose endTime is in the interval of (B's endTime, A's startTime)            
                 */
                var degree = 0;
                var curEndTime = sortedRequestsOnStartTime[0].endTime;
                sortedRequestsOnStartTime[0].degree = 0;
                var j = 0;
                for(var i in sortedRequestsOnStartTime){
                    //delta = sortedRequestsOnStartTime[i].startTime -elements.requests[0].startTime;
                    //console.log("SortedStartTime: "+delta+" "+sortedRequestsOnStartTime[i].url);
                    if(i==0)
                        continue;
                    var startTime = sortedRequestsOnStartTime[i].startTime;
                    for( ; j<sortedRequestsOnEndTime.length - 1; j++){
                        if( (startTime>=sortedRequestsOnEndTime[j].endTime) && 
                            (startTime<sortedRequestsOnEndTime[j+1].endTime)){
                            url = sortedRequestsOnEndTime[i].url;
                            item = urlDict[url];
                            sortedRequestsOnEndTime[item[1]].degree = sortedRequestsOnEndTime[j].degree + 1;
                            //degree = degree < sortedRequestsOnEndTime[item[1]].degree ?  
                            //            sortedRequestsOnEndTime[item[1]].degree : degree;
                        }
                    }
                }
                for(var i in sortedRequestsOnEndTime){
                    var delta1 = sortedRequestsOnEndTime[i].startTime -elements.requests[0].startTime;
                    var delta2 = sortedRequestsOnEndTime[i].endTime -elements.requests[0].startTime;
                    var degree = sortedRequestsOnEndTime[i].degree;
                    url = sortedRequestsOnEndTime[i].url;
                    console.log("degree: "+degree+" from:"+delta1+" to:"+delta2+" url:"+url);
                }
                
              elements = new URLElements();
            }// if requests.length > 0
        }//else if eventName==load
    }
    else{
        bg.console.log("[contentscript] receive unknown msg from "+sender+": "+message.name);
    }
}

chrome.runtime.onConnect.addListener(function(connection) {
    if(connection.name=="devtools-page"){    
        connection.onMessage.addListener(devToolsListener);
        bg.console.log("[devtools] successfully created tunnel with devtools-page");
        connection.onDisconnect.addListener(function (connection){
            connection.onMessage.removeListener(devToolsListener);
        });
    }
    else if(connection.name == "content-page"){
        connection.onMessage.addListener(contentScriptListener);
        bg.console.log("[contentscript] successfully created tunnel");
        connection.onDisconnect.addListener(function (connection){
            connection.onMessage.removeListener(contentScriptListener);
        });
    }
    else{
        bg.console.log("tunnel request from "+connection.name);
    }
});
