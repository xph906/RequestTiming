// Background page -- background.js

var bg = chrome.extension.getBackgroundPage();

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

chrome.runtime.onConnect.addListener(function(connection) {
    if(connection.name == "devtools-page"){
        // assign the listener function to a variable so we can remove it later
        var devToolsListener = function(message, sender, sendResponse) {
            //chrome.tabs.executeScript(message.tabId,{ file: message.scriptToInject });
            //iterateProperties(message.startTime);
            bg.console.log("receive msg from "+sender+" "+message.url+" "+objToString(message.request.startedDateTime));
            //message.tabId
            //sender.postMessage({name:"response msg abcde"});
        }

        bg.console.log("successfully created tunnel with devtools-page");
        connection.onMessage.addListener(devToolsListener);

        connection.onDisconnect.addListener(function (port){
            port.onMessage.removeListener(devToolsListener);
        });
    }
    else{
        bg.console.log("tunnel request from "+connection.name);
    }

   
});