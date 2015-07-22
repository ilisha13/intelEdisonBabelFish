/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */

/************************************************************************************
   Project:     Babel Fish Universal Translator
                --------------------------------
                
   Description: This project is a node.js version of Dave Conroy's Raspberry PI
                python based Universal Translator. This implementation utilizes
                the Intel Edison and Google Speech and Translate APIs.
                
   Filename     main.js
   Platform     Edison running node.js
   Authors:     Ilisha Ramachandran, Hari Ramachandran
   
   Credit:      Mike McCool
                Hari Ramachandran
       
*************************************************************************************/

/***********************************************************************************
    Load the required node.js modules/define globals
    
        - mraa for controlling sensors and various devices on the edison
        - google-translate for access to the google translate apis
        - node-curl is a node.js module that serves as a wrapper for the curl functions
        - googleApiKey is the registered Google API linked to the Translate APIs
        - node-google-text-to-speech: google text to speech APIs
        
 ************************************************************************************/

var mraa = require('mraa'); //require mraa
var googleApiKey = "AIzaSyA7aaB3zL8J69U6dKHzcpSZR_jo2iGikWY";   // My registered key. Do not share this!
var googleTranslate = require('google-translate')(googleApiKey);// Register the key
var exec = require('child_process').exec;
var gLanguage;
var Cylon = require('cylon');
var gLangArray = new Array ("Mandarin", "French", "Malay", "Hindi", "German");
var gLangIndex = 0;
var gAngleArray = new Array (20, 40, 60, 80, 100);
var gCurrentLang = 0;
var gTextToTranslate = "Hello";
var gColourArray = new Array ("Red", "Blue", "Green");
var gColourIndex = 0;
var gCurrentColour = 0;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var gMessageRecieved = 0;


console.log('MRAA Version: ' + mraa.getVersion()); //write the mraa version to the Intel XDK console
console.log('**************** Babel Fish Universal Translater Application ***********');
            
/***********************************************************************************
   Setup the LEDs and other sensors or devices.        
 ***********************************************************************************/          

var myOnboardLed = new mraa.Gpio(13); //LED hooked up to digital pin 13 (or built in pin on Intel Galileo Gen2 as well as Intel Edison)
myOnboardLed.dir(mraa.DIR_OUT); //set the gpio direction to output
var ledState = true; //Boolean to hold the state of Led

 /***********************************************************************************
    Intialize the LCD. When Yellow button pressed, text changes colour when yellow button pressed. 
 ************************************************************************************/

    // Initialize Jhd1313m1 at 0x62 (RGB_ADDRESS) and 0x3E (LCD_ADDRESS) 

var jsUpmI2cLcd = require('jsupm_i2clcd');
var LcdTextHelper = require('./lcd_text_helper');
var lcd = new jsUpmI2cLcd.Jhd1313m1(6, 0x3E, 0x62);
var lcdText = new LcdTextHelper(lcd);

lcdText.set([
  "  Babel ", 
  "        Fish!"
]);

function babelFishDisplay() //sets the YELLOW button to change the colour of the LCD display 
{   
    setInterval(function()
    {
        if (buttonYellow.value() == 1)
            {
                gCurrentColour = gColourIndex;
                lcd.clear();
                lcdColour("",0,0,gColourArray[gColourIndex]);
                gColourIndex = gColourIndex + 1;
            }
                
        if (gColourIndex == (gColourArray.length))
            { 
                gColourIndex = 0;
            }
    },100);
}

/***********************************************************************************
   Load the grove sensor UPM and initialize the button
 ***********************************************************************************/

    var groveSensor = require('jsupm_grove');

    // Create first button using GPIO pin 2
    var buttonRed = new groveSensor.GroveButton(2);

    // Create second button using GPIO pin 5
    var buttonGreen = new groveSensor.GroveButton(5);

    // Create third button using GPIO pin 6
    var buttonYellow = new groveSensor.GroveButton(6);
    
/***********************************************************************************
    Calling the functions and their intervals
 ************************************************************************************/

    setInterval(translateButtonPressed,500);

    setInterval(readTextToTranslate,1000);

    blinkLedsPeriodically();  

    cylonSetUp(); 
    
    setInterval(babelFishDisplay,100);

/************************* readTextToTranslate ***************************************
    * Read Bluetooth transmitted text 
 ************************************************************************************/
function readTextToTranslate()
{
    var fs = require("fs");
    var fileName = "translate.txt";

    fs.exists(fileName, function(exists) 
    {
      if (exists) 
      {
        fs.stat(fileName, function(error, stats) 
        {
          fs.open(fileName, "r", function(error, fd) 
        {
            var buffer = new Buffer(stats.size);

            fs.read(fd, buffer, 0, buffer.length, null, function(error, bytesRead, buffer) 
            {
              var data = buffer.toString("utf8", 0, (buffer.length-2));

                console.log(data);
                gTextToTranslate = data;

              fs.close(fd);

                fs.unlink('translate.txt', function (err) 
                {
                    if (err){
                        throw err;
                    } else {
                    console.log('successfully deleted file');
                    }
                });
            });
        });
        });
      }
    });
}

/****************************** babelTranslate **************************************
 * This function is a the main translation text function
 ************************************************************************************/
function babelTranslate(textToTranslate,language)
{ 
    gLanguage = language;
    googleTranslate.translate(textToTranslate, returnLangCode(language), playTranslatedText);  
 }

/****************************** playTranslatedText **************************************
 * This function is a callback invoked after a Google Translate API is called. This
   function first checks to see if an error condition exists, if not, it simply
   displays the translated text in the callback function.
 ************************************************************************************/
function playTranslatedText(err,translation)
{
        console.log("In translation callback!!! ");
        var text;
       
        if (!err)
        {
            console.log("Translation successful!!");
            console.log("------------------------");
            console.log(translation.translatedText);  
            
            text = translation.translatedText;
            easySpeakTTS(text, gLanguage);  
        }
        else
            console.log(err);
 }

/****************************** blinkLedsPeriodically **************************************
 * This function blinks the led on your Edison board. It uses the setTimeout function to call itself after a
   specified time duration
 ******************************************************************************************/
function blinkLedsPeriodically()
{
  myOnboardLed.write(ledState?1:0); //if ledState is true then write a '1' (high) otherwise write a '0' (low)
  ledState = !ledState; //invert the ledState
  setTimeout(blinkLedsPeriodically,100); //call the indicated function after 1 second (1000 milliseconds)
}

/****************************** playWaveFile **************************************
 * This function uses the exec command to play a file. This function assumes a 
   default location for the wave file
 ************************************************************************************/
function playWaveFile(fileName)
{
    exec("gst-launch-1.0 filesrc location=" +fileName + " ! wavparse ! pulsesink", function(error,stdout,stderr)
            {
                if (!error)
                {
                    console.log("File played!!");   
                }
                else    
                    console.log(stderr);
            });
}

/****************************** easySpeakTTS **************************************
  Write translated text to text file
 ************************************************************************************/
function easySpeakTTS(translatedText, language)
{
    var shellCommand;
    
    /* Generate the shell command .. will look something like        
        espeak -v ms "Selamat Pagi"
    */
    
    //shellCommand = "espeak -v " + returnLangCode(language) + " " + "'" + translatedText +"'";  
    
    shellCommand = "espeak -v " + returnLangCode(language) + " -s120 " + "'" + translatedText +"'" + " --stdout > xlate.wav";
    console.log(" Send to TTS " + shellCommand);
    
    /****** Now write to the TTS engine. Use the exec command  *******/
    
    exec(shellCommand, function(error,stdout,stderr){
    
            if (!error)
                playWaveFile('xlate.wav');
        
    });
    
}

/****************************** returnLangCode **************************************
  Write translated text to text file
 ************************************************************************************/
function returnLangCode(language)
{
    var langCode;
    
    switch(language)
    {
            
        case "English":
                langCode = 'en';
            break;            
            
        case "English US":
                langCode = 'en-us';
            break;         
                        
        case "English UK":
                langCode = 'en-uk';
            break;               
            
        case "German":
                langCode = 'de';
            break;   
                        
        case "Spanish":
                langCode = 'es';
            break;   
     
        case "Hindi":
                langCode = 'hi';
            break;               
            
         case "Mandarin":
                langCode = 'zh';
            break;               
                       
        case "Malay":
                langCode = 'ms';
            break;     
            
        case "Italian":
                langCode = 'it';
            break; 
            
        case "French":
                langCode = 'fr';
            break; 
            
        case "Tamil":
                langCode = 'ta';
            break;
            
        default:
                console.log("Language not supported");
                langCode = "";
            break;            
    }
    
    return(langCode);
}

/****************************** lcdText  **************************************
  Write text to lcd panel
 ******************************************************************************/
function lcdColour(text, row, col, color)
{
    switch(color)
    {
        case "Red":
            lcd.setColor(255, 0, 0);
            break;                 
  
        case "Blue":
            lcd.setColor(53, 39, 249);
            break; 
        
        case "Green":
            lcd.setColor(0, 255, 0);
            break;        
    }
    
    /** Now display the text **/
    
        lcd.setCursor(row,col);
        lcd.write(text);  
}

/******************** Translate Button Pressed ************************************
   Translation that plays when you press the Green button 
 ***********************************************************************************/
  function translateButtonPressed() 
    {
        if (buttonGreen.value() == 1)
        {
            console.log("Button = 1"); 
            console.log("Start Translate...");
            console.log("Language=" + gLangArray[gCurrentLang]);
            
            babelTranslate(gTextToTranslate, gLangArray[gCurrentLang]);
        }
    } 

/*************************** Setting up the Servo ****************************************
    * Sets up the servo
    * Servo is either controlled through the web server, or by pressing the RED button
    * Wherever the servo lands, the translated text will be played in that specific language 
 ***********************************************************************************/
function cylonSetUp()
{
    Cylon
  .robot()
  .connection('edison', { adaptor: 'intel-iot' })
  .device('servo', { driver: 'servo', pin: 3, connection: 'edison', limits: { bottom: 20, top: 160 }}) //sets up servo to be controlled by pin 3 and go from 20 degrees to 160 degrees (which will be five movements)
  .on('ready', function(my) 
        {
            console.log("Device is ready");    
            my.servo.angle(gAngleArray[gLangIndex]); //sets each language at a specific angle 
           
            setInterval(function()
            {
                if (buttonRed.value() == 1) //what to do when the RED button is pressed 
                {
                    gCurrentLang = gLangIndex;
                    console.log ("Language is " + gLangArray[gLangIndex]);
                    lcd.clear();
                    setTimeout(function(){
                                  lcdText.set([
                                    gTextToTranslate
                                  ]);
                                }, 1000);
                      
                    babelTranslate(gTextToTranslate, gLangArray[gCurrentLang]);
                    my.servo.angle(gAngleArray[gLangIndex]);
                    gLangIndex = gLangIndex + 1; 
                    console.log ("gLangindex is" + gLangIndex);
                }
                
                if (gMessageRecieved == 1) //what to do when a message is recieved from the web server 
                {
                    babelTranslate(gTextToTranslate, gLangArray[gCurrentLang]);
                    my.servo.angle(gAngleArray[gCurrentLang]);
                    lcd.clear();
                    setTimeout(function(){
                                  lcdText.set([
                                    gTextToTranslate
                                  ]);
                                }, 1000);
                    
                    gMessageRecieved = 0;  
                    gLangIndex = gCurrentLang;
                    
                }
                
                if (gLangIndex == (gLangArray.length)) //resetting the location of the servo when it reaches the end of its cycle (when RED button is pressed) 
                { 
                    console.log("gLangIndex greater"+gLangIndex);
                    console.log("gCurrentLang is" + gCurrentLang);
                    gLangIndex = 0;
                }
            },200); 
        });
    
        Cylon.start(); //initiates the Cylon function 
}

/***************************** testButtons ****************************************
    * Used to test each button (RED, YELLOW, GREEN) to make sure they work. 
 ***********************************************************************************/

function testButtons() 
{
         if (buttonRed.value() == 1)
        {
            console.log("Red button pressed"); 
        }
    
         if (buttonYellow.value() == 1)
        {
            console.log("Yellow button pressed"); 
        }
        
        if (buttonGreen.value() == 1)
        {
            console.log("Green button pressed"); 
        } 
}


/***************************** Web Controller ******************************************
    * Sets up the web server by accessing the index.html file
    * Setting up what to do when a message is recieved from the web server 
*****************************************************************************************/

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/babel.jpg', function(req, res){
    res.sendFile(__dirname + '/babel.jpg');
});

io.on('connection', function(socket){
  socket.on('language', function(lang){
    console.log(lang[0]+lang[1]);
        gTextToTranslate = lang[1];
        gCurrentLang = lang[0];
        gMessageRecieved = 1;
        console.log("Language = ", gLangArray[lang[0]]);
        console.log(" Text = ", gTextToTranslate);
  });
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});

