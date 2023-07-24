let portOpen = false; // tracks whether a port is corrently open
let portPromise; // promise used to wait until port succesfully closed
let holdPort = null; // use this to park a SerialPort object when we change settings so that we don't need to ask the user to select it again
let port; // current SerialPort object
let reader; // current port reader object so we can call .cancel() on it to interrupt port reading
/*升级掌中宝一代所用到的全局变量 */
let updateflag = false;
let filebyte = new Uint8Array();
let stm_byte = new Uint8Array(402720);
let updatestatus = 0x00; 
let xor_byte = 0x00;
let page_num = 0;

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
    document.getElementById("check96bit").addEventListener("click", check96bit);
    document.getElementById("update").addEventListener("click", upDate);
    document.getElementById("fileInput").addEventListener("change", selectFile);

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
        document.getElementById("check96bit").disabled = false;
        document.getElementById("update").disabled = false;



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
         if(updateflag == true){////选择文件之后，处于升级状态
           upDate(recdata);
           recdata = [];////清空数据，不干扰下次接
         }
         else 
         {
          if(chkRecdata(recdata) == true){
            cmdSend(recdata);
            recdata = [];////清空数据，不干扰下次接
          }

         }

		   
		 
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
  document.getElementById("term_window").value += "发送数据:"+ byteArrayToHex(data) + '\n'; 
  //console.log("write lock");
  
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
		      staflag = false;
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
       //console.log(truedata);
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
  //console.log("key:",key);
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
    console.log("additional"+ j + ":" + byteArrayToHex(rduint));
    tempstr0 = byteArrayToHex(rduint);
    str_additionaldata = str_additionaldata.concat(tempstr0.substring(0,15),tempstr0.substring(16,27));///去掉0和A，并合并在一起
  }
   /////////////////crc1/////////////////////////
   let crc1 = new Array();
   crc1[0] = truedata[242];crc1[1] = truedata[243];
   console.log("crc1:"+byteArrayToHex(crc1));
  
  axios({
    method:'post',
    url:'http://47.91.230.137:8081/V4/decode96',
    data:{    
      'deviceid':str_deviceid,   
      'rawdata':str_rawdata,
      'chipid': str_chipid,
      'calcType': "48",
      'methodVersion':'04',
      'additionaldata':str_additionaldata,
      'deviceType':'01',
      'chipData':str_chipData,
      'deviceCode': str_deviceid,
      'tips':'cn',
      'pageLimits':{'numRowsNum':3,'currentPageNum':1}}
  }).then(function(response) {
    console.log(response.data);
  });
  
}
 
function sendData48(){
  
  let cmddata = new Uint8Array(38);
  let frame = new Uint8Array([0xea,0x00,0x23,0x48,0xef,0x12,0x02]);
  let idkey = new Uint8Array([0x00,0x11,0x22,0x33,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
  let aesidkey = encAesData(idkey);
  //console.log(aesidkey);
  //let crcout = new Uint8Array(2);
  //crcout = CRC16_CCITT(aesidkey);
  let crcout = CRC16_CCITT(aesidkey);
  //crcout[0] = 0x55; crcout[1] = 0xaa;
  //console.log(crcout);
  let um1um2 = new Uint8Array([0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa,0xaa]);
  let xordata = new Uint8Array([0x00]);///4 +16 +2 + 12 +1
  for(let i = 0; i < 7; i++){
    cmddata[i] = frame[i];
  }
  for(let i = 0 ; i < 16; i++){
    cmddata[7+i] = aesidkey[i];
  }
  //cmddata[23] = 0xf8; cmddata[24] = 0xa8;
  for(let i=0; i < 2; i++){
    cmddata[23+i] = crcout[i];
  }
  
  for(let i = 0; i < 12; i++)
  {
    cmddata[25+i] = um1um2[i];
  }

  //for(var i in aesidkey){cmddata.push(aesidkey[i]);}
  //for(var i in crcout){cmddata.push(crcout[i]);}
  //for(var i in um1um2){cmddata.push(um1um2[i]);}
  //cmddata = cmddata.concat(aesidkey,crcout,um1um2);

  for(let i = 0; i < 33;i++){
    xordata[0] ^= cmddata[3+i];
  }
  cmddata[37] = xordata[0];
  //cmddata.length = 38;
  //console.log(cmddata);
  //console.log(cmddata.length)
  //console.log(crcout);
  //cmddata = cmddata.concat(xordata);
  //for(var i in xordata){cmddata.push(xordata[i]);}

  //const writer = port.writable.getWriter();
  //const data = new Uint8Array([0xea, 0x00, 0x04, 0xff, 0xff,0xfe,0xfa]); //
  //await writer.write(cmddata);
  //writer.releaseLock();
  //document.getElementById("term_window").value += "发送数据:"+ byteArrayToHex(cmddata) + '\n'; 

  sendString(cmddata);

}


function check96bit(){
  chiparray = new Array();
  axios({
    method:'post',
    url:'http://47.91.230.137:8081/V4/findDecode96',
    data:{    
      'deviceid':'f96ca264958d47f59e71c849ee5c352a',
      'calcType': "48",
      'pageLimits':{'numRowsNum':8,'currentPageNum':1}}
  }).then(function(response) {
   // console.log(response.data);
   // console.log(response.data.error_msg);
   // console.log(response.data.status);
    //console.log(response.data.contentData.map.replyInputFinishs.myArrayList);

    var tempget = response.data.contentData.map.replyInputFinishs.myArrayList;
    //console.log(tempget);
    //console.log(tempget.length);
    //chiparray = dataget.1.map;
    for(let i= 0; i<tempget.length;i++){
      chiparray[i] = tempget[i].map;
      document.getElementById("term_window").value += "//////////////"+ i +"/////////////"+ '\n'; 
      document.getElementById("term_window").value += "chipData:"+ chiparray[i].chipData + '\n'; 
      document.getElementById("term_window").value += "chipId:"+ chiparray[i].chipId + '\n'; 
      document.getElementById("term_window").value += "key96:"+ chiparray[i].key96 + '\n'; 
      //console.log(chiparray[i]);
    }
   
  });

}

async function upDate (recdata){
  let tx_data_0 = new Uint8Array(4);
  let tx_data_1 = new Uint8Array(12);
  //let tx_data_2 = new Uint8Array(133);
  let tx_data_2 = new Uint8Array([0x01,0x62,0x9D,0x01,0x0A,0x0B,0x0C,0x07,0x11,0x07,0x4F,0x5B,0x50,0x12,0x0E,0x17,0x11,0x4F,0x53,0x52,
                                  0x53,0x52,0x4C,0x00,0x0B,0x0C,0x62,0x56,0x52,0x50,0x55,0x50,0x52,0x62,0x62,0x62,0x62,0x62,0x62,0x62,
                                  0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,
                                  0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,
                                  0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,
                                  0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,
                                  0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62,0x62]);
  let tx_data_3 = new Uint8Array(1029);
  switch(updatestatus)
  {
    case 0x00:///初始化状态，接收到第一个字节，如0x92。发送两条命令，间隔800MS
      if(recdata[0] == 0x92){
        test1 = 4;
        tx_data_0[0] = filebyte[131932];tx_data_0[1] = filebyte[131933];tx_data_0[2] = filebyte[131934];tx_data_0[3] = filebyte[131935];
        //tx_data[0] = 0x55;tx_data[1] = 0xaa;
        //console.log(filebyte);
        //console.log(typeof(filebyte));
        //console.log(tx_data_0);
        //console.log(typeof(tx_data_0));
        sendString(tx_data_0);
        await sleep(800);
        console.log("send one command");
        for(let i=0;i<12;i++){
          tx_data_1[i] = filebyte[131920 + i];
        } 
        if (tx_data_1[11] < 0x80)
        {
            xor_byte = (tx_data_1[7] & 0x80) | (tx_data_1[9] & 0x40) | (tx_data_1[8] & 0x20) | (tx_data_1[10] & 0x10) | (tx_data_1[1] & 0x08) | (tx_data_1[2] & 0x04) | (tx_data_1[3] & 0x02) | (tx_data_1[4] & 0x01);
        }
        else
        {
            xor_byte = (tx_data_1[6] & 0x80) | (tx_data_1[4] & 0x40) | (tx_data_1[5] & 0x20) | (tx_data_1[2] & 0x10) | (tx_data_1[10] & 0x08) | (tx_data_1[9] & 0x04) | (tx_data_1[8] & 0x02) | (tx_data_1[1] & 0x01);
        }
		    console.log(xor_byte);
        sendString(tx_data_1);
        updatestatus = 0x01;
      }
      break;
    case 0x01:///发送133个字节
      if(recdata[0] = 0x43){
      
        sendString(tx_data_2);
        updatestatus = 0x02;
      }
      break;
    case 0x02:///发送升级数据，结合计数器
      if(recdata[0] == 0x06){
        await sleep(100);///延时100ms

       // if(page_num < 128){
          for(let i = 0;i<1024;i++){ tx_data_3[i+3] = stm_byte[page_num * 1024 + i] ^ xor_byte;}
        //}
        //else{
        //  for(let i = 0;i<1024;i++){tx_data_3[i+3] = filebyte[page_num * 1024 + i + 16] ^ xor_byte;}
       // }

        tx_data_3[0] = 0x02;
        tx_data_3[1] = ((page_num + 1) & 0xff)^xor_byte;
        tx_data_3[2] = (0xff - tx_data_3[1])^xor_byte;

        tx_data_3[1027] = 0x66 ^ xor_byte;
        tx_data_3[1028] = 0x5e ^ xor_byte;

       

        if(page_num == 392){///just for test
          updatestatus = 0x03;
        }

        sendString(tx_data_3);

        console.log("upto:" + page_num);
        page_num = page_num + 1;
      }
      break;
    case 0x03:///发送最后一个PAGE的数据
      if(recdata[0] == 0x06){
        await sleep(100);///延时100ms
        tx_data_3[0] = 0x02;
        tx_data_3[1] = ((393 + 1) & 0xff)^xor_byte;
        tx_data_3[2] = (0xff - tx_data_3[1])^xor_byte;
        for(let i =0; i<288;i++){
          tx_data_3[i+3] = stm_byte[393 * 1024 + i] ^ xor_byte;
        }
        //for(let i = 0; i < 733;i++){
        //  tx_data_3[291+i] = 0x00;
        //}

        tx_data_3[1027] = 0x01 ^ xor_byte;
        tx_data_3[1028] = 0x5b ^ xor_byte;

        sendString(tx_data_3);
        updatestatus = 0x04;

      }
      break;
      default:
        break;

  }

  //tx_data = [];////清空发送数据，
  //if(recdata[0] == 0x92){
  //  console.log(filebyte[131932]);
  //}
  /*先解决文件的读取问题 */
  /*if (window.File && window.FileReader && window.FileList && window.Blob) {
    alert ('Great success! All the File APIs are supported.');
  } else {
    alert('The File APIs are not fully supported in this browser.');
  }*/
  
 
}

function selectFile(){
  var file = this.files[0];
  var readerfile = new FileReader();
  //var filebyte = new Uint8Array();
  readerfile.readAsArrayBuffer(file);
  //reader.readAsBinaryString(file);
  readerfile.onload = function(){
    //console.log(reader.result);
    document.getElementById("term_window").value += "读取升级文件完成！！！" + '\n'; 
    //filebyte = reader.result;
    filebyte = Array.prototype.slice.call(new Uint8Array(readerfile.result));////array 和 arraybuffer是不一样的
    //console.log(filebyte);  
    //console.log(filebyte.length);
    //for(let i=0; i<16;i++){
    //  console.log(filebyte[i]);
    //}
    //let stm_byte = new Uint8Array(filebyte.length - 16);
    for (let  j = 0; j < 131920; j++)
    {
        stm_byte[j] = filebyte[j];
    }
    for (let k = 131936; k < filebyte.length ; k++)
    {
        stm_byte[k-16] = filebyte[k];
    }
    //stm_byte.length = filebyte.length - 16;

    updateflag = true;
    //console.log(filebyte.length);  
    //console.log(stm_byte);
    //console.log(stm_byte.length);
    //console.log(updateflag);
    //return filebyte;
  }
  
}

// Clear the contents of the term_window textarea
function clearTerminal() {
  document.getElementById("term_window").value = "";
}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

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
