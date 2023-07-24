let portOpen = false; // tracks whether a port is corrently open
let portPromise; // promise used to wait until port succesfully closed
let holdPort = null; // use this to park a SerialPort object when we change settings so that we don't need to ask the user to select it again
let port; // current SerialPort object
let reader; // current port reader object so we can call .cancel() on it to interrupt port reading

// Do these things when the window is done loading
window.onload = function () {
  // Check to make sure we can actually do serial stuff
  if ("serial" in navigator) {
    // The Web Serial API is supported.
    // Connect event listeners to DOM elements
    document.getElementById("openclose_port").addEventListener("click", openClose);
    document.getElementById("change").addEventListener("click", changeSettings);
    document.getElementById("clear").addEventListener("click", clearTerminal);
    document.getElementById("send").addEventListener("click", sendString);
    document.getElementById("term_input").addEventListener("keydown", detectEnter);
    document.getElementById("send48data").addEventListener("click", sendData48);

    // Clear the term_window textarea
    clearTerminal();

    // See if there's a prefill query string on the URL
    const params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });
    // Get the value of "some_key" in eg "https://example.com/?some_key=some_value"
    let preFill = params.prefill; // "some_value"
    if (preFill != null) {
      // If there's a prefill string then pop it into the term_input textarea
      document.getElementById("term_input").value = preFill;
    }
  } else {
    // The Web Serial API is not supported.
    // Warn the user that their browser won't do stupid serial tricks
    alert("The Web Serial API is not supported by your browser");
  }
};

// This function is bound to the "Open" button, which also becomes the "Close" button
// and it detects which thing to do by checking the portOpen variable
async function openClose() {
  // Is there a port open already?
  //var cnt = 0;
  let recdata = new Array();
  if (portOpen) {
    // Port's open. Call reader.cancel() forces reader.read() to return done=true
    // so that the read loop will break and close the port
    reader.cancel();
    console.log("attempt to close");
  } else {
    // No port is open so we should open one.
    // We write a promise to the global portPromise var that resolves when the port is closed
    portPromise = new Promise((resolve) => {
      // Async anonymous function to open the port
      (async () => {
        // Check to see if we've stashed a SerialPort object
        if (holdPort == null) {
          // If we haven't stashed a SerialPort then ask the user to select one
          port = await navigator.serial.requestPort();
        } else {
          // If we have stashed a SerialPort then use it and clear the stash
          port = holdPort;
          holdPort = null;
        }
        // Grab the currently selected baud rate from the drop down menu
        var baudSelected = parseInt(document.getElementById("baud_rate").value);
        // Open the serial port with the selected baud rate
        await port.open({ baudRate: baudSelected });

        // Create a textDecoder stream and get its reader, pipe the port reader to it
        //const textDecoder = new TextDecoderStream();
        //reader = textDecoder.readable.getReader();
        //const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        const reader = port.readable.getReader();
        //const writer = port.writable.getWriter();
        //const data = new Uint8Array([0xea, 0x00, 0x04, 0xff, 0xff,0xfe,0xfa]); //

        // If we've reached this point then we're connected to a serial port
        // Set a bunch of variables and enable the appropriate DOM elements
        portOpen = true;
        document.getElementById("openclose_port").innerText = "Close";
        document.getElementById("term_input").disabled = false;
        document.getElementById("send").disabled = false;
        document.getElementById("clear").disabled = false;
        document.getElementById("change").disabled = false;
        document.getElementById("send48data").disabled = false;
        document.getElementById("send46data").disabled = false;
        document.getElementById("send4ddata").disabled = false;

        // NOT SUPPORTED BY ALL ENVIRONMENTS
        // Get port info and display it to the user in the port_info span
        let portInfo = port.getInfo();
        document.getElementById("port_info").innerText =
          "Connected to device with VID " +
          portInfo.usbVendorId +
          " and PID " +
          portInfo.usbProductId;

        // Serial read loop. We'll stay here until the serial connection is ended externally or reader.cancel() is called
        // It's OK to sit in a while(true) loop because this is an async function and it will not block while it's await-ing
        // When reader.cancel() is called by another function, reader will be forced to return done=true and break the loop
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            //await writer.write(data);
            //writer.releaseLock();
            //console.log('WRITE HAPPEN');
            reader.releaseLock(); // release the lock on the reader so the owner port can be closed
            //await writer.write(data);
            //writer.releaseLock();
      
            break;
          }
          
          //await writer.write(data);
          //writer.releaseLock();
          //reader.releaseLock(); // release the lock on the reader so the owner port can be closed
          //console.log('WRITE HAPPEN');
          
          
          //+console.log(cnt++);
         document.getElementById("term_window").value += byteArrayToHex(value) + '\n'; // write the incoming string to the term_window textarea
		     for(var i in value){
			     recdata.push(value[i]);//将接收到的数据追加到recdata后面
		     }
		     if(chkRecdata(recdata) == true){
			     cmdSend(recdata);
           recdata = [];////清空数据，不干扰下次接收
            //sendString();
         }
		  //console.log(recdata);
		  //console.log(recdata.length);
		  //sendString();
          //console.log('WRITE HAPPEN');
          //console.log(value);

          //await writer.write(data);
          //writer.releaseLock();
        }

        // If we've reached this point then we're closing the port
        // first step to closing the port was releasing the lock on the reader
        // we did this before exiting the read loop.
        // That should have broken the textDecoder pipe and propagated an error up the chain
        // which we catch when this promise resolves
        await readableStreamClosed.catch(() => {
          /* Ignore the error */
        });
        // Now that all of the locks are released and the decoder is shut down, we can close the port
        await port.close();

        // Set a bunch of variables and disable the appropriate DOM elements
        portOpen = false;
        document.getElementById("openclose_port").innerText = "Open";
        document.getElementById("term_input").disabled = true;
        document.getElementById("send").disabled = true;
        document.getElementById("change").disabled = true;
        document.getElementById("port_info").innerText = "Disconnected";

        console.log("port closed");

        // Resolve the promise that we returned earlier. This helps other functions know the port status
        resolve();
      })();
    });
  }

  return;
}

// Change settings that require a connection reset.
// Currently this only applies to the baud rate
async function changeSettings() {
  holdPort = port; // stash the current SerialPort object
  reader.cancel(); // force-close the current port
  console.log("changing setting...");
  console.log("waiting for port to close...");
  await portPromise; // wait for the port to be closed
  console.log("port closed, opening with new settings...");
  openClose(); // open the port again (it will grab the new settings while opening the port)
}

// Send a string over the serial port.
// This is easier than listening because we know when we're done sending
async function sendString(data) {
  const writer = port.writable.getWriter();
  //const data = new Uint8Array([0xea, 0x00, 0x04, 0xff, 0xff,0xfe,0xfa]); //
  await writer.write(data);
  writer.releaseLock();
  console.log("write lock");
  
}
 /*
  1，不知为何，web serial api接收数据的时候，不是一帧数据解完，而是可能分几次接收，所以必须每次接收检查的数据。
     只有数据完整了，才能考虑执行后面的步骤。
  2，根据掌中宝一代，解码返回数据是以0XEA开头，后面两个BYTE数据数据长度，最后一个BYTE的数据是XOR的特征规则，
     chkRecdata做了完整的校验才让数据得以通过。
 */

function chkRecdata (recdata){
 
  for(let i=0; i < recdata.length;i++){
    if(recdata[i] == 0xea){
      //console.log('0xea--' + recdata);

      if(recdata[i+1] == undefined || recdata[i+2] == undefined){////还没有收完两个BYTE的数据长度
	      //console.log('undefined1');
        return false;////回去继续接收
      } 

      let cntrec = recdata[i+1] * 256 + recdata[i+2];
	  //console.log(cntrec);
	    let xordat = recdata[i+1] ^ recdata[i+2];
	    let staflag = true;
      for(let j = 0; j < cntrec; j++ ){
        if(recdata[i+3+j] == undefined){
		      //console.log('undefined2');
		      staflg = false;
          break;////打断j循环，回到i循环，继续寻找下一个EA
		  
        }
		    xordat = xordat ^ recdata[i+3+j];
      }
	    if(xordat == 0x00 && staflag == true){
		    //console.log(recdata);
		    return true;
	    }
    }   
  }
  return false;
}

function cmdSend (recdata){
	//let senddata = new Uint8Array(); //
  let cipher = new Array();
	let type = recdata[3];
  let truedata = new Array();
  let temp = new Array();
	switch(type){
		case 0xff:
		  const senddata = new Uint8Array([0xea, 0x00, 0x04, 0xff, 0xff,0xfe,0xfa]); //
		  sendString(senddata);
		  break;
		case 0x48:
		   const senddata1 = new Uint8Array([0xea, 0x00, 0x05, 0x48, 0xff,0x10,0x01,0xa6]);
       sendString(senddata1);
       //console.log(recdata);
       for(let j=0; j<16;j++){
         for(let i=0; i<16; i++){
           cipher[i] = recdata[6 + j * 16 + i];
         }
         temp = decAesData(cipher);
         for(var i in temp){
          truedata.push(temp[i]);//将解密的数据追加到truedata后面
         }
       }
       console.log(truedata);
       expTruedata(truedata);
		   break;
		default:
		   break;
	}
}

/*AES解密应用*/
function decAesData (cipher){
  var ct, key;
  let keystring = "ac122a355cbbca8d1f5148ba9867f952";
  //let ts =  "c93437c431cc2630090d990dCB6a6846";
  key = hex2s(keystring);
  ct = hex2s(byteArrayToHex(cipher));
  //ct = hex2s(ts);
  //console.log("run here");
  //console.log(rijndaelDecrypt(ct, key, "ECB"));
  return rijndaelDecrypt(ct, key, "ECB");
}

/* AES加密应用*/
function encAesData(plain){
  var ct, key;
  let keystring = "ac122a355cbbca8d1f5148ba9867f952";
  key = hex2s(keystring);
  ct = hex2s(byteArrayToHex(plain));

  return rijndaelEncrypt(ct,key,"ECB");
}



function expTruedata(truedata){///解析数据
  let str_rawdata = "";///string to 
  let str_additionaldata = "";
  let str_deviceid = "";
  let str_chipid = "";
  let str_chipData = "";
  let tempstr0 = "";
  let rduint = new Array();
  
  /////////////////////////////////////////
  let deviceid = new Array();
  for(let i=0;i<12;i++){ deviceid[i] = truedata[i];}
  console.log("设备序列号:"+byteArrayToHex(deviceid));
  str_deviceid = byteArrayToHex(deviceid);
  /////////////////////////////////////////
  let chipid = new Array();
  for(let i=0;i<4;i++){chipid[i] = truedata[12+i];}
  console.log("芯片ID:"+byteArrayToHex(chipid));
  str_chipid = byteArrayToHex(chipid);
  ////////////////////////////////////////////
  for(let j=0;j<8;j++){
  
    for(let i=0;i<14;i++){ rduint[i] = truedata[16+i + j * 14];}
    console.log("rawdata"+ j + ":" + byteArrayToHex(rduint));
    tempstr0 = byteArrayToHex(rduint);
    str_rawdata = str_rawdata.concat(tempstr0.substring(0,15),tempstr0.substring(16,27));///去掉0和A，并合并在一起
  }
 /*
  /////////////////////////////////
  
  for(let i=0;i<14;i++){ rduint[i] = truedata[30+i];}
  console.log("rawdata1:"+byteArrayToHex(rduint));
  
 ////////////////////////////////
 
  for(let i=0;i<14;i++){
    rawdata2[i] = truedata[44+i];
  }
  console.log("rawdata2:"+byteArrayToHex(rawdata2));
  //////////////////////////////////////
  
  for(let i=0;i<14;i++){
    rawdata3[i] = truedata[58+i];
  }
  console.log("rawdata3:"+byteArrayToHex(rawdata3));
  //////////////////////////////////////
  
  for(let i=0;i<14;i++){
    rawdata4[i] = truedata[72+i];
  }
  console.log("rawdata4:"+byteArrayToHex(rawdata4));
  //////////////////////////////////////
  
  for(let i=0;i<14;i++){
    rawdata5[i] = truedata[86+i];
  }
  console.log("rawdata5:"+byteArrayToHex(rawdata5));
  //////////////////////////////////////
  
  for(let i=0;i<14;i++){
    rawdata6[i] = truedata[100+i];
  }
  console.log("rawdata6:"+byteArrayToHex(rawdata6));
  ///////////////////////////////////////
 
  for(let i=0;i<14;i++){
    rawdata7[i] = truedata[114+i];
  }
  console.log("rawdata7:"+byteArrayToHex(rawdata7));
  */
  /*////////////////////////////////////
  let um1data = new Array();
  for(let i=0;i<4;i++){
    um1data[i] = truedata[128+i];
  }
  console.log("um1data:"+byteArrayToHex(um1data));

 //////////////////////////////////////////
  let um2data = new Array();
  for(let i=0;i<8;i++){
    um2data[i] = truedata[132+i];
  }
  console.log("um2data:"+byteArrayToHex(um2data));
  */
 /////////////////////////////////////////////
  let chipdata = new Array();
  for(let i=0;i<12;i++){ chipdata[i] = truedata[128+i];}
  console.log("chipdata:"+byteArrayToHex(chipdata));
  str_chipData = byteArrayToHex(chipdata);

  /////////////////CRC0////////////////////////
  let crc0 = new Array();
  crc0[0] = truedata[140];crc0[1] = truedata[1];
  console.log("crc0:"+byteArrayToHex(crc0)); 
  /////////////////////////////////////////////
  let methodVersion = new Array();
  methodVersion[0] = truedata[142];
  console.log("methodVersion:"+byteArrayToHex(methodVersion));
  ////////////////////////////////////////////
  let deviceType = new Array();
  deviceType[0] = truedata[143];
  console.log("deviceType:"+byteArrayToHex(deviceType));
  ////////////////////////////////////////////
  for(let j=0;j<7;j++){
  
    for(let i=0;i<14;i++){ rduint[i] = truedata[144 + i + j * 14];}
    console.log("rawdata"+ j + ":" + byteArrayToHex(rduint));
    tempstr0 = byteArrayToHex(rduint);
    str_additionaldata = str_additionaldata.concat(tempstr0.substring(0,15),tempstr0.substring(16,27));///去掉0和A，并合并在一起
  }

  /*
  let rawdata8 = new Array();
  for(let i=0;i<14;i++){
    rawdata8[i] = truedata[144+i];
  }
  console.log("rawdata8:"+byteArrayToHex(rawdata8));
  ////////////////////////////////////////////////
  let rawdata9 = new Array();
  for(let i=0;i<14;i++){
    rawdata9[i] = truedata[158+i];
  }
  console.log("rawdata9:"+byteArrayToHex(rawdata9));
  ////////////////////////////////////////////////
  let rawdataa = new Array();
  for(let i=0;i<14;i++){
    rawdataa[i] = truedata[172+i];
  }
  console.log("rawdataa:"+byteArrayToHex(rawdataa));
  ////////////////////////////////////////////////
   let rawdatab = new Array();
   for(let i=0;i<14;i++){
     rawdatab[i] = truedata[186+i];
   }
   console.log("rawdatab:"+byteArrayToHex(rawdatab));
  ////////////////////////////////////////////////
   let rawdatac = new Array();
   for(let i=0;i<14;i++){
     rawdatac[i] = truedata[200+i];
   }
   console.log("rawdatac:"+byteArrayToHex(rawdatac));
  ////////////////////////////////////////////////
  let rawdatad = new Array();
  for(let i=0;i<14;i++){
    rawdatad[i] = truedata[214+i];
  }
  console.log("rawdatad:"+byteArrayToHex(rawdatad));
  ////////////////////////////////////////////////
   let rawdatae = new Array();
   for(let i=0;i<14;i++){
     rawdatae[i] = truedata[228+i];
   }
   console.log("rawdatae:"+byteArrayToHex(rawdatae));
  */
   /////////////////crc1/////////////////////////
   let crc1 = new Array();
   crc1[0] = truedata[242];crc1[1] = truedata[243];
   console.log("crc1:"+byteArrayToHex(crc1));


  
  axios({
    method:'post',
    url:'http://47.91.230.137:8081/V4/decode96',
    data:{
      //'deviceid': '3835384E425002FF2716FFFF',
      'deviceid': str_deviceid,
      //'rawdata':'38F27E7B9B362D6B65BD621929B5F724F2163377A132DF524AC5877E7EE524BA2DFFC563750918A7137E4004D72D03F745503BA415E46512B620362A80670428A18431EEAA27F5BDBFA095C348D129AC23B98A6870C36C9ACD33A33ACF5B07990B0872C4965A19F5',
      'rawdata':str_rawdata,
      'chipid': str_chipid,
      'calcType': "48",
      'methodVersion':'02',
      //'additionaldata':'3402D8CB97C68B787D73469DF7B4D55F8B17110C9AAD626F93CB3EA717A39D6344DC5153E4FBCD6D09E1BCCECDB2E06E9C3FF41BEF916BD54C5538D68595AFF956FA99F31F595DA0AF175ED66776D969AD0C7AADFE35ACC6A85C62',
      'additionaldata':str_additionaldata,
      'deviceType':'03',
      //'chipData':'AAAA8765AAAAAAAAAAAAAAAA',
       'chipData':str_chipData,
      //'chipData':'AAAA8765AAAAAAAAAAAAAAAA',
      'deviceCode': str_deviceCode,
      'tips':'cn',
      'pageLimits':{
          'numRowsNum':3,
          'currentPageNum':1}}
      }).then(function(response) {
    console.log(response.data);
  

}

async function sendData48(){
  
  let testdata = new Uint8Array([0xe7,0x02,0xee,0xec]);
  const writer = port.writable.getWriter();
  await writer.write(testdata);
  writer.releaseLock();
  document.getElementById("term_window").value += "发送48数据:"+ byteArrayToHex(testdata) + '\n'; // write the incoming string to the term_window textarea
  
  let temp0 = new Uint8Array([0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff]);
  let temp1 = new Uint8Array();
  temp1 = encAesData(temp0);

  console.log("加密数据:" + byteArrayToHex(temp1));

  /*let temp2 = new Uint8Array([0x3a,0xeb,0x00,0x57,0x99,0x77,0x68,0xd0,0x27,0xbb,0x82,0x38,0x31,0x8a,
                              0xcd,0xc6,0x53,0xe1,0xcb,0x92,0x52,0x30,0x3a,0x8d,0xf0,0x3f,0x60,0x6a,
                              0xf2,0x6c,0x43,0x22,0x73,0x46,0x03,0xc0,0xca,0xaf,0xb7,0x09,0xc6,0x3a,
                              0x72,0xd6,0xb8,0xa0,0x4e,0x9c,0x7b,0xf0,0xca,0x50,0x61,0x89,0xeb,0x8a,
                              0xc1,0xbc,0x05,0x68,0x13,0x6c,0x5a,0xa0,0x73,0xea,0x10,0x49,0x47,0x1a,
                              0xc0,0x82,0x4d,0xd4,0xc8,0x4f,0xf3,0xf0,0x1c,0x2f,0x2b,0x6d,0x80,0x1a,
                              0x4d,0xc7,0x21,0x02,0x6f,0x19,0x84,0x80,0x2e,0x7e,0x70,0x85,0x71,0x7a
]);
  console.log(crc16(temp2));*/
  let rawdata0 = '84422f2003b58f509e22e367ce1a';
  let tempstr= rawdata0.substring(0,15);
  console.log("testb:"+rawdata0);
  //console.log(rawdata0.substring(0,15));
  //console.log(rawdata0.substring(16,27));
  //rawdata0 = rawdata0.slice(28);
  //rawdata0 = rawdata0.slice(16);
  rawdata0 = tempstr.concat(rawdata0.substring(16,27))
  console.log("testa:"+rawdata0);
  /*let str_deviceid = '3835384E425002FF2716FFFF';
  let str_rawdata = '38F27E7B9B362D6B65BD621929B5F724F2163377A132DF524AC5877E7EE524BA2DFFC563750918A7137E4004D72D03F745503BA415E46512B620362A80670428A18431EEAA27F5BDBFA095C348D129AC23B98A6870C36C9ACD33A33ACF5B07990B0872C4965A19F5';
  let str_additionaldata = '3402D8CB97C68B787D73469DF7B4D55F8B17110C9AAD626F93CB3EA717A39D6344DC5153E4FBCD6D09E1BCCECDB2E06E9C3FF41BEF916BD54C5538D68595AFF956FA99F31F595DA0AF175ED66776D969AD0C7AADFE35ACC6A85C62';
  let str_chipData = 'AAAA8765AAAAAAAAAAAAAAAA';
  let str_chipid = 'A698F5F8';
  let str_deviceCode = '3835384E425002FF2716FFFF';
  axios({
    method:'post',
    url:'http://47.91.230.137:8081/V4/decode96',
    data:{
      //'deviceid': '3835384E425002FF2716FFFF',
      'deviceid': str_deviceid,
      //'rawdata':'38F27E7B9B362D6B65BD621929B5F724F2163377A132DF524AC5877E7EE524BA2DFFC563750918A7137E4004D72D03F745503BA415E46512B620362A80670428A18431EEAA27F5BDBFA095C348D129AC23B98A6870C36C9ACD33A33ACF5B07990B0872C4965A19F5',
      'rawdata':str_rawdata,
      'chipid': str_chipid,
      'calcType': "48",
      'methodVersion':'02',
      //'additionaldata':'3402D8CB97C68B787D73469DF7B4D55F8B17110C9AAD626F93CB3EA717A39D6344DC5153E4FBCD6D09E1BCCECDB2E06E9C3FF41BEF916BD54C5538D68595AFF956FA99F31F595DA0AF175ED66776D969AD0C7AADFE35ACC6A85C62',
      'additionaldata':str_additionaldata,
      'deviceType':'03',
      //'chipData':'AAAA8765AAAAAAAAAAAAAAAA',
       'chipData':str_chipData,
      //'chipData':'AAAA8765AAAAAAAAAAAAAAAA',
      'deviceCode': str_deviceCode,
      'tips':'cn',
      'pageLimits':{
          'numRowsNum':3,
          'currentPageNum':1}}
      }).then(function(response) {
    console.log(response.data);
  
  });*/
}

// Clear the contents of the term_window textarea
function clearTerminal() {
  document.getElementById("term_window").value = "";
}

// This function in bound to "keydown" in the term_input textarea.
// It intercepts Enter keystrokes and calls the sendString function
function detectEnter(e) {
  var key = e.keyCode;

  // If the user has pressed enter
  if (key == 13) {
    e.preventDefault();
    sendString();
  }
  return;
}
