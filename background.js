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

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

/***********************************************
 URLClass
 ***********************************************/
function URLClass(url){
    this.url = url.toLowerCase();
    this.deadEnd = false;
    this.waitForReceivingTime = false;
    this.setDeadEnd();
    this.setWaitForReceivingTime();
}
URLClass.prototype.setDeadEnd = function(){
    if( this.url.endsWith(".jpg") || this.url.endsWith(".png") ||
        this.url.endsWith(".jpeg")|| this.url.endsWith(".swf") ||
        this.url.endsWith(".gif") || this.url.endsWith(".css"))
        this.deadEnd = true;
    else
        this.deadEnd = false;
}
URLClass.prototype.setWaitForReceivingTime = function(){
    if( this.url.endsWith(".jpg") || this.url.endsWith(".png") ||
        this.url.endsWith(".jpeg")|| this.url.endsWith(".swf") ||
        this.url.endsWith(".gif") || this.url.endsWith(".js")  ||
        this.url.endsWith(".css"))
        this.waitForReceivingTime = true;
    else
        this.waitForReceivingTime = false;
}
URLClass.prototype.toString = function(){
    return "URL:"+this.url+" [DEADEND:"+this.deadEnd+"] [WAITFORRT:"+this.waitForReceivingTime+"]";
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
        request.url = new URLClass(request.url);
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
function DFVisitor(arr, index, output,preDegree){
    var degree = arr[index].degree;
    if(preDegree >= degree){
        bg.console.log("ERROR find a circul "+output);
        return ;
    }
    var url = arr[index].url.url;
    var delta = arr[index].delta+"";
    var nextList = arr[index].nextList;
    var curOut = "["+url.substring(url.length-5,url.length);
    curOut += "]["+degree+"degree]["+delta+"] ";
    output += curOut;
    
    if(nextList.length == 0){
        //bg.console.log(output);
        return;
    }

    for(var i in nextList){
        if(i==index)
            continue;
        console.log(nextList+"  "+index+" => "+i);
        //DFVisitor(arr,i,output);
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
                console.log(sortedRequestsOnStartTime[0].url.toString()+" <==> " + 
                            sortedRequestsOnEndTime[0].url.toString());
                sortedRequestsOnEndTime[0].degree = 0;
                sortedRequestsOnEndTime[0].prev = -1;
                sortedRequestsOnEndTime[0].delta = 0;
                var j = 0;
                for(var i in sortedRequestsOnEndTime){
                    sortedRequestsOnEndTime[i].nextList = [];
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
                    
                    /*bg.console.log("Start i:"+i+" j:"+j+" ITEM:"+item[0]+" "+item[1]+" "+tmpURL);
                    while(j<sortedRequestsOnEndTime.length - 1){
                        if( (startTime>=sortedRequestsOnEndTime[j].endTime) && 
                            (startTime <sortedRequestsOnEndTime[j+1].endTime)){
                            sortedRequestsOnEndTime[item[1]].prev = j;
                            if(sortedRequestsOnEndTime[j].url.waitForReceivingTime==false){                   
                                var halfReceivingTime = sortedRequestsOnEndTime[j].receiveTime /2;
                                //bg.console.log("DEBUG:"+sortedRequestsOnEndTime[j].url.url+" "+halfReceivingTime);
                                sortedRequestsOnEndTime[item[1]].delta = 
                                        Math.abs(startTime - 
                                                sortedRequestsOnEndTime[j].endTime - halfReceivingTime);
                            }
                            else{
                                sortedRequestsOnEndTime[item[1]].delta = startTime -
                                                sortedRequestsOnEndTime[j].endTime;
                            }
                            
                            sortedRequestsOnEndTime[item[1]].degree = 
                                        sortedRequestsOnEndTime[j].degree + 1;
                            break;
                        }
                        else{
                            j++;
                        }
                    }*/
                    var curIndex = 0;
                    for(j=0; j<sortedRequestsOnEndTime.length - 1; j++){
                        if(sortedRequestsOnEndTime[j].url.deadEnd){
                            continue;
                        }
                        else if( startTime >= sortedRequestsOnEndTime[j].endTime){
                            curIndex = j;
                        }
                        else{
                            break;
                        }
                    }
                    sortedRequestsOnEndTime[item[1]].prev = curIndex;
                    if(sortedRequestsOnEndTime[curIndex].url.waitForReceivingTime==false){                   
                        var halfReceivingTime = sortedRequestsOnEndTime[j].receiveTime /2;
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
                    else{
                        //bg.console.log("SET PREV: "+item[1]+" length:"+sortedRequestsOnEndTime.length);
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
                        prevURL = sortedRequestsOnEndTime[prev].url.url;
                        //bg.console.log("prev: "+prev);
                        sortedRequestsOnEndTime[prev].nextList.push(i);
                    }
                    /*
                     *   bg.console.log(i+" DEGREE: "+degree+" [START:"+delta1+" END:"+delta2+
                     *           "] [URL:"+tmpURL+"] [PREVURL:"+prev+" "+prevURL+"]"+
                     *           " [DEADEnd:"+sortedRequestsOnEndTime[curIndex].url.deadEnd+"] [DELTA:"+delta+"]");
                     */
                }
                for(var i in sortedRequestsOnEndTime){
                    var ttt = sortedRequestsOnEndTime[i].url.url;
                    bg.console.log(i+" "+sortedRequestsOnEndTime[i].degree+" || "+ttt.substring(ttt.length-10,ttt.length)+" next: "+sortedRequestsOnEndTime[i].nextList);
                }
                DFVisitor(sortedRequestsOnEndTime, firstIndex, "",-1);
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
