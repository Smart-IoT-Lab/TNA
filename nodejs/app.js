const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const http = require("http");
const mysql = require("mysql");
//const decivesRouter = require("./routes/devices"); //라우터만들기, 안드로이드 접속처리
const e = require("express");
require('dotenv').config({ path: "serverip.env"});  //서버 연결을 위한 정보

//사용자관련 정보[미작성]


app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json()); //클라이언트가 서버에 요청을 할 때 JSON 데이터도 처리할 수 있도록 만듬
app.use(bodyParser.urlencoded({extended: false}));  //url인코딩 => body라는 속성을 쓰고 body 안에서 flag라는 인자를 뽑아내기 위함
//app.use("/devices", devicesRouter); // 라우터만들기, 안드로이드 접속처리

//연구실DB 정보
const connection  = mysql.createConnection({
    host:process.env.dbhost,
    port:process.env.dbport,
    user:process.env.dbuser,
    password:process.env.dbpassword,
    database:process.env.dbname
});

//MQTT서버 접속
const client = mqtt.connect(process.env.mqttip);
client.on("connect", () => {
    console.log("mqtt connect");
    client.subscribe("card");
});

//수정필요 (카드id를 사람이름으로 변환하는작업);
client.on("message", async(topic, message)=> {
    console.log(message);
    var obj = '{"card" : 222}'
    obj = JSON.parse(obj);
    //var obj = JSON.parse(message);
    // var date = new Date();
    // var year = date.getFullYear();
    // var month = date.getMonth();
    // var today = date.getDate();
    // var hours = date.getHours();
    // var minutes = date.getMinutes();
    // var seconds = date.getSeconds();
    // obj.time = new Date(Date.UTC(year, month, today, hours, minutes, seconds));    
    obj.tna = new String("출근");
    console.log(obj);

    var sql = "INSERT INTO tna (name, time, tna) VALUES (\'" + obj.card + "\',now(),\'" + obj.tna + "\')";
    connection.query(sql, function(err,result) {
        if (err) {
            console.log(err);
        } else {
            console.log("Insert OK");
        }
    });
});
    
app.set("port", "3000");    //웹서버 포트 설정
var server = http.createServer(app);
var io = require("socket.io")(server);
io.on("connection", (socket)=> {
    socket.on("socket_evt_mqtt", function(data) {
        connection.query('SELECT * from tna where id <= 10 order by id desc', function(err, rows, fields) {
                socket.emit("socket_evt_mqtt", JSON.stringify(rows))
        });
    });
});

//웹서버 구동
server.listen(3000, (err) => {
    if(err) {
        return console.log(err);
    } else {
        console.log("server ready");
        //connection DB
        connection.connect((err) => {
            if(err) {
                console.log(err);
            } else {
                console.log("DB connected");
            }
        });
    }
});