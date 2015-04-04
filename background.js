// Background page -- background.js

var bg = chrome.extension.getBackgroundPage();
function URLElements(){
    this.requests = [];
    this.DOMContentLoadedTime = 0;
    this.loadTime = 0;
}
var elements = new URLElements();
var urlTable = {};
var reqDict = {};
var dependencyGraph = {};

var FileSystemAppID = "lgagklodbbhcljogcdhmjfpgpcohedcp";
var FSConnector = chrome.runtime.connect(FileSystemAppID);
FSConnector.postMessage({name:"timingInfo"});


String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

/***********************************************
 URLClass
 ***********************************************/
function URLClass(url,host,path){
    this.url = url.toLowerCase();
    this.deadEnd = false;
    this.waitForReceivingTime = false;
    this.pathname = path;
    this.host = host;
    //this.parser = document.createElement('a');
    //this.parser.href = url.toLowerCase();
    this.setDeadEnd();
    this.setWaitForReceivingTime();
}
URLClass.prototype.setDeadEnd = function(){
   /*   if( this.pathname.endsWith(".jpg") || this.pathname.endsWith(".png") ||
    *        this.pathname.endsWith(".jpeg")|| this.pathname.endsWith(".swf") ||
    *        this.pathname.endsWith(".gif") || this.pathname.endsWith(".json"))
    *        this.deadEnd = true;
    *    else
    *        this.deadEnd = false;
    */
    return false;
}
URLClass.prototype.setWaitForReceivingTime = function(){
    if( this.pathname.endsWith(".jpg") || this.pathname.endsWith(".png") ||
        this.pathname.endsWith(".jpeg")|| this.pathname.endsWith(".swf") ||
        this.pathname.endsWith(".gif") || this.pathname.endsWith(".js")  ||
        this.pathname.endsWith(".css") )
        this.waitForReceivingTime = true;
    else
        this.waitForReceivingTime = false;
}
URLClass.prototype.toString = function(){
    return "URL:"+this.url+" [DEADEND:"+this.deadEnd+"] [WAITFORRT:"+this.waitForReceivingTime+"]";
}
URLClass.prototype.getPath = function(){
    //var parser = document.createElement('a');
    //parser.href = this.url;
    return this.parser.pathname;
}
URLClass.prototype.getHost = function(){
  return this.parser.host;
}


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
        
        var t1 = request.startTime+"";
        var t2 = request.endTime+"";
        var key = t1 + request.url + t2;
        if(key in reqDict){
            bg.console.log("debug: repeat request removed: "+key);
            return;
        }
        reqDict[key]=true;
        request.url = new URLClass(request.url,request.host,request.path);
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

function GraphVisitor(arr, index){
    this.arr = arr;
    this.firstIndex = index;
    this.DFVisitorList = {};
    this.largestEstimatedVal = 0;
    this.largestRealVal = 0;
}
GraphVisitor.prototype.DFVisitor = function(index, output,preDegree,totalValue,estimatedValue){
    var degree = this.arr[index].degree;
    if(preDegree >= degree){
        bg.console.log("ERROR find a LOOP "+output);
        return ;
    }
    
    var url = this.arr[index].url.url;
    var delta = "delta:"+this.arr[index].delta;
    var waitTime = "wait:"+this.arr[index].waitTime;
    var receiveTime = "receive:"+this.arr[index].receiveTime;
    var totalTime =  "total:"+this.arr[index].totalTime;
    var connTime = "conn:"+this.arr[index].connectTime;
    var blockTime = "blocked:"+this.arr[index].blockedTime;
    var respBodySize = "bodySize:"+this.arr[index].respBodySize;
    var startTime = "startTime:"+this.arr[index].startTime;
    var allTime = this.arr[index].delta + this.arr[index].totalTime;
    var debugDelta = 0;
    totalValue += allTime;
    if(this.arr[index].waitTime < 1000){
        estimatedValue += this.arr[index].waitTime * 3;  
        debugDelta = allTime - this.arr[index].waitTime * 3; 
    }   
    else{
        estimatedValue += this.arr[index].waitTime;
        debugDelta = allTime - this.arr[index].waitTime ;
    }
    //estimatedValue += this.arr[index].waitTime * 2;

    var allTimeStr = "allTime:"+allTime;
    var debugDeltaStr = "debugDelta:"+debugDelta;
    var nextList = this.arr[index].nextList;
    //bg.console.log("DEBUG: nextList:"+nextList);
    
    var curOut = +"["+url.substring(url.length-7,url.length);
    curOut += " || degree:"+degree+" || "+delta+" || "+connTime;
    curOut += " || "+waitTime+" || "+receiveTime+" || "+respBodySize+" || "+totalTime+" || "+allTimeStr+
            " || "+blockTime+" || "+debugDeltaStr+"] \n";
    output += curOut;
    
    if(nextList.length == 0){
        bg.console.log("TT:"+totalValue+" ET:"+estimatedValue+"\n"+output+"\n");
        if(totalValue>this.largestRealVal)
            this.largestRealVal = totalValue;
        if(estimatedValue>this.largestEstimatedVal)
            this.largestEstimatedVal = estimatedValue;
        return;
    }

    for(var i in nextList){
        var nextIndex = nextList[i];
        if(nextIndex==index)
            continue;
        if(nextIndex in this.DFVisitorList){
            bg.console.log("ERROR LOOP: "+index+" TO "+nextIndex);
            continue;
        }
        else{
            this.DFVisitorList[nextIndex] = degree + 1;
        }
        //bg.console.log("DF:"+nextList+"  "+index+" => "+i);
        this.DFVisitor(nextIndex,output,degree,totalValue,estimatedValue);
    }
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
            var firstURL = message.url;
            elements.loadTime = parseInt(message.time);
            bg.console.log("onload event gets fired: received:"+elements.requests.length+" requests");
            if(elements.requests.length > 0){
                /* Keep the requests belonging to this page 
                 * FIXME: Note that the URL here is not accurate 
                 * because it is not the original URL if redirecion happens 
                 */
                elements.requests.sort(compareRequestStartTime);
                bg.console.log("  first url:"+firstURL);
                for(var index=0; index<elements.requests.length; index++){
                    if(elements.requests[index].url.url == firstURL){
                        bg.console.log("  "+index+" request is the url");
                        elements.requests = elements.requests.slice(index);
                        break;
                    }
                }
                bg.console.log("keep "+elements.requests.length+" effective requests");
                urlTable[firstURL] = elements;

                /* Sort the requests based on start time and end time */
                for(var i in elements.requests){
                    //bg.console.log("URL:"+elements.requests[i].url.toString()+" Totaltime:"+elements.requests[i].totalTime);
                    var url = elements.requests[i].url;
                    if(url.waitForReceivingTime){
                        endTime = elements.requests[i].startTime + elements.requests[i].totalTime;
                        //bg.console.log("waitfor receiving time:"+elements.requests[i].totalTime+" url:"+url.url);
                    }
                    else{
                        endTime = elements.requests[i].startTime + elements.requests[i].totalTime -
                                elements.requests[i].receiveTime;
                        //var tmp = elements.requests[i].totalTime -
                        //        elements.requests[i].receiveTime;
                        //bg.console.log("NOT waitfor receiving time:"+tmp+" url:"+url.url);
                    }
                    if(endTime == elements.requests[i].startTime)
                        endTime += 1;
                    elements.requests[i].endTime = endTime;         
                    //bg.console.log("receiveTime:"+elements.requests[i].receiveTime+" url:"+elements.requests[i].url);
                }
                var sortedRequestsOnStartTime = elements.requests.slice();
                var sortedRequestsOnEndTime = elements.requests.slice();
                sortedRequestsOnStartTime.sort(compareRequestStartTime);
                sortedRequestsOnEndTime.sort(compareRequestEndTime);
                
                /* Create a dict to map a request's start time and end time 
                 * url => (startTimeList index, endTimeList index)
                 */
                var urlDict = {};
                for(var i in sortedRequestsOnStartTime){
                    var t1 = sortedRequestsOnStartTime[i].startTime+"";
                    var t2 = sortedRequestsOnStartTime[i].endTime+"";
                    var urlOnStartArr = t1+sortedRequestsOnStartTime[i].url.url+t2;
                    if(urlOnStartArr in urlDict){
                        bg.console.log("ALERT: repeated url "+urlOnStartArr);
                    }
                    urlDict[urlOnStartArr] = [i];
                    for(var j in sortedRequestsOnEndTime){
                       
                        var t1 = sortedRequestsOnEndTime[j].startTime+"";
                        var t2 = sortedRequestsOnEndTime[j].endTime+"";
                        var urlOnEndArr = t1+sortedRequestsOnEndTime[j].url.url+t2;
                        if(urlOnStartArr == urlOnEndArr){
                            urlDict[urlOnStartArr].push(j);
                            break;
                        }
                    }
                    if(urlDict[urlOnStartArr].length != 2){
                        console.log("error "+urlOnStartArr+": cannot find ending time");
                    }
                }

                /* Calculate the degree of each request (dependecy) and store it into sortedRequestsOnEndTime.
                 * We assume that request A depends on request B if and only if A's startTime is larger than B's 
                 * endTime and there is no request C whose endTime is in the interval of (B's endTime, A's startTime)            
                 */
                var degree = 0;
                var stdStartTime = sortedRequestsOnStartTime[0].startTime;
                var stdEndTime = sortedRequestsOnEndTime[0].endTime;
                var stdLoadingTime = elements.loadTime - stdStartTime;
                bg.console.log("Loading Time: "+stdLoadingTime);
                bg.console.log(sortedRequestsOnStartTime[0].url.toString()+" <==> " + 
                            sortedRequestsOnEndTime[0].url.toString());
                sortedRequestsOnEndTime[0].degree = 0;
                sortedRequestsOnEndTime[0].prev = -1;
                sortedRequestsOnEndTime[0].delta = 0;

                var j = 0;
                for(var i in sortedRequestsOnEndTime){
                    sortedRequestsOnEndTime[i].nextList = [];
                    sortedRequestsOnEndTime[i].delta = 0;
                }

                for(var i in sortedRequestsOnStartTime){
                    delta = sortedRequestsOnStartTime[i].startTime -elements.requests[0].startTime;
                    //console.log("SortedStartTime: "+delta + " " + 
                    //            sortedRequestsOnStartTime[i].url.toString()+
                    //            " "+sortedRequestsOnStartTime.length);
                    if(i==0)
                        continue;
                    var startTime = sortedRequestsOnStartTime[i].startTime;
                    
                    if(startTime <= stdEndTime){
                        bg.console.log("ignore req: "+i+" "+sortedRequestsOnStartTime[i].url.toString());
                        bg.console.log("stdStartTime:"+stdStartTime+" stdEndTime:"+stdEndTime+
                                    " startTime:"+startTime);
                        continue;
                    }
                    var t1 = sortedRequestsOnStartTime[i].startTime+"";
                    var t2 = sortedRequestsOnStartTime[i].endTime+"";
                    var tmpURL = t1+sortedRequestsOnStartTime[i].url.url+t2;
                    item = urlDict[tmpURL];
                  
                    var curIndex = 0;
                    for(j=0; j<sortedRequestsOnEndTime.length - 1; j++){
                        if(item[1] == j)
                            continue;
                        else if(sortedRequestsOnEndTime[j].url.deadEnd)
                            continue;
                        else if( startTime >= sortedRequestsOnEndTime[j].endTime)
                            curIndex = j;
                        else
                            break;
                    }
                    sortedRequestsOnEndTime[item[1]].prev = curIndex;
                    if(sortedRequestsOnEndTime[curIndex].url.waitForReceivingTime==false){                   
                        //var halfReceivingTime = sortedRequestsOnEndTime[j].receiveTime /2;
                        //bg.console.log("DEBUG:"+sortedRequestsOnEndTime[j].url.url+" "+halfReceivingTime);
                        sortedRequestsOnEndTime[item[1]].delta = 
                                Math.abs(startTime - 
                                        sortedRequestsOnEndTime[curIndex].endTime - 
                                            sortedRequestsOnEndTime[j].receiveTime);
                    }
                    else{
                        sortedRequestsOnEndTime[item[1]].delta = startTime -
                                        sortedRequestsOnEndTime[curIndex].endTime;
                    }
                    
                    sortedRequestsOnEndTime[item[1]].degree = 
                                sortedRequestsOnEndTime[curIndex].degree + 1;


                    if(!("prev" in sortedRequestsOnEndTime[item[1]])){
                        bg.console.log("NO PREV: "+tmpURL+" index:"+i+" j:"+curIndex+" deadEnd:"+
                                sortedRequestsOnEndTime[curIndex].deadEnd+" length:"+sortedRequestsOnEndTime.length);
                    }
                }
                
                var firstIndex = 0;
                for(var i in sortedRequestsOnEndTime){
                    var delta1 = sortedRequestsOnEndTime[i].startTime -elements.requests[0].startTime;
                    var delta2 = sortedRequestsOnEndTime[i].endTime -elements.requests[0].startTime;
                    var degree = sortedRequestsOnEndTime[i].degree;
                    var tmpURL = sortedRequestsOnEndTime[i].url.url;
                    var prev = sortedRequestsOnEndTime[i].prev;
                    var delta = sortedRequestsOnEndTime[i].delta;
                    //bg.console.log(i+" prev:"+prev);
                    var prevURL;
                    if(tmpURL==firstURL){
                        bg.console.log("first URL index:"+firstIndex);
                        firstIndex = i;
                    }
                    if(prev == -1){
                        prevURL = "NONE";
                    }
                    else{
                        //bg.console.log("prev: "+prev);
                        if( (typeof sortedRequestsOnEndTime[prev] == 'undefined') || 
                            (typeof sortedRequestsOnEndTime[prev].url == 'undefined')){
                            prevURL = "NONE";
                            bg.console.log("No Prev: "+i+" "+prev+" len:"+sortedRequestsOnEndTime.length);
                            bg.console.log("No Prev: "+sortedRequestsOnEndTime[prev]);
                        }
                      else{
                            prevURL = sortedRequestsOnEndTime[prev].url.url;
                            sortedRequestsOnEndTime[prev].nextList.push(i);
                        }                    
                    }
                    /*
                     *   bg.console.log(i+" DEGREE: "+degree+" [START:"+delta1+" END:"+delta2+
                     *           "] [URL:"+tmpURL+"] [PREVURL:"+prev+" "+prevURL+"]"+
                     *           " [DEADEnd:"+sortedRequestsOnEndTime[curIndex].url.deadEnd+"] [DELTA:"+delta+"]");
                     */
                }
                var rsMsg = JSON.stringify(sortedRequestsOnEndTime);
                FSConnector.postMessage({name:"TimingResult",firstURL:firstURL, resultArr:rsMsg, loadingTime:stdLoadingTime});
                chrome.storage.local.set({name:"TimingResult",firstURL:firstURL, resultArr:rsMsg, loadingTime:stdLoadingTime}, 
                    function() {
                        // Notify that we saved.
                        bg.console.log('TimingResults have been saved');
                    });
                for(var i in sortedRequestsOnEndTime){
                    var ttt = sortedRequestsOnEndTime[i].url.url;
                    var dddd = sortedRequestsOnEndTime[i].delta;
                    var prev = sortedRequestsOnEndTime[i].prev;
                    /*bg.console.log("SIZE:"+sortedRequestsOnEndTime[i].respBodySize+
                                    " ReceiveTime:"+sortedRequestsOnEndTime[i].receiveTime+
                                    " WaitTime:"+sortedRequestsOnEndTime[i].waitTime+
                                    " URL:"+sortedRequestsOnEndTime[i].url.url);*/
                }
               /* 
                var graphVisitor = new GraphVisitor(sortedRequestsOnEndTime, firstIndex); 
                graphVisitor.DFVisitorList = {};        
                graphVisitor.DFVisitor(firstIndex,"",-1,0,0);
                bg.console.log( "LargestRealVal:"+graphVisitor.largestRealVal + 
                                " LargestEstimatedVal:"+graphVisitor.largestEstimatedVal);
                */
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
