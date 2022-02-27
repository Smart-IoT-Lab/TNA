//안드로이드와 라우터는 시간이 나면 추가적으로 개발할 예정. 아직 계획 없음

const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const http = require("http");
const mysql = require("mysql");
//const decivesRouter = require("./routes/devices"); //라우터만들기, 안드로이드 접속처리
require('dotenv').config({ path: "serverip.env"});  //서버 연결을 위한 정보

//사용자관련 정보를 담고 있는 전역변수(cardusermatch함수에서 사용)
var user = new Array();

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json()); //클라이언트가 서버에 요청을 할 때 JSON 데이터도 처리할 수 있도록 만듬
app.use(bodyParser.urlencoded({extended: false}));  //url인코딩 => body라는 속성을 쓰고 body 안에서 flag라는 인자를 뽑아내기 위함
//app.use("/devices", devicesRouter); // 라우터만들기, 안드로이드 접속처리

//연구실DB 정보
const condb = mysql.createConnection({
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
    var obj = JSON.parse(message);  //받은 정보를 object 객체에 저장(JSON 형식임)
    
    //사용자와 카드정보를 매칭시킴
    condb.query('SELECT * from cards LIMIT 20', function(err, rows, fields) {
        if(err) {
            console.log("cardusermatch err");
        } else {
            for(var i = 0 ; i< rows.length ; i++) {
                user[i] = rows[i];
            }
        }
    });

    var card_owner = "anonymous";
    //반복문을 돌며 카드주인을 찾음 => card_owner에는 사람 이름이 저장되어있음
    //맞는 사람이 없으면 DB에 저장하지 않음
    for(var i = 0; i < user.length ; i++) {
        if(user[i].card_number == obj.card) {
            card_owner = user[i].user_name;
        }
    }
    if(card_owner == "anonymous") {
        return;
    }
    obj.card_owner = card_owner;
    
    //현재 시간 정보를 가져와서 DB에 저장
    var today = new Date();
    var year = today.getFullYear();
    var month = ('0' + (today.getMonth() + 1)).slice(-2);
    var day = ('0' + today.getDate()).slice(-2);
    var date = year + '-' + month  + '-' + day;
    date = date + "(" + await getWeekday(date) + ")";
    var hours = ('0' + today.getHours()).slice(-2); 
    var minutes = ('0' + today.getMinutes()).slice(-2);
    var seconds = ('0' + today.getSeconds()).slice(-2); 
    var time = hours + ':' + minutes  + ':' + seconds;
    obj.tnadate = new String(date);
    obj.tnatime = new String(time);

    //카드의 소유자가 현재 출근인지 퇴근인지 구분 (comment : 진짜 비동기, 동기 처리 개화난다. mysql2못쓰겠어서 이렇게선언했습니다.)
    var commutequery = 'SELECT tna from tna where name = \'' + card_owner + "\' order by date desc, time desc LIMIT 1";
    condb.query(commutequery, function(err, rows, fields) {
        if(rows == "") {
            console.log("처음");
            obj.tna = "출근";
            inputquery(obj);
        }
        else if(rows[0].tna == "출근") {
            obj.tna = "퇴근";
            inputquery(obj);
        }
        else {
            obj.tna = "출근";
            inputquery(obj);
        }
    });
});

app.set("port", "3000");    //웹서버 포트 설정
var server = http.createServer(app);
var io = require("socket.io")(server);
io.on("connection", (socket)=> {
    socket.on("socket_evt_mqtt", function(data) {
        condb.query('SELECT * from tna order by date desc, time desc LIMIT 20', function(err, rows,fields) {
                socket.emit("socket_evt_mqtt", JSON.stringify(rows));
        });
    });


});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/TNA.html");
});

app.post('/search', function(req, res) {
    var searchstr = "<tr><td> 날짜 </td><td> 이름 </td><td> 시간 </td><td> 출퇴근 </td></tr>";
    var html="";
    var searchquery = "SELECT * FROM tna where date LIKE \'" + req.body.date + "%\' and name LIKE \'" + req.body.name + "%\'";
        condb.query(searchquery, function(err, rows, fields) { 
            for(let i = 0 ; i < rows.length ; i++) {
                searchstr = searchstr + "<tr><td>" + rows[i].date + "</td><td>" + rows[i].name + "</td><td>" + rows[i].time + "</td><td>" + rows[i].tna + "</td></tr>";
            }
        html = html + `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8" />
        <title>SmartIotLab 출결확인 서비스</title>
        <style>
            h2{text-align : center};
            table, th, td {
                border: 1px solid #bcbcbc;
                text-align : center;
            }
            table {
                width : 100%;
                border: 1px solid #444444;
                border-collapse : collapse;
                margin-left :auto;
                margin-right :auto;
            }
            th, td {
                border: 1px solid #444444;
                padding: 10px;
            }
        </style>
        </head>
        <body>
            <h2>SmartIot Lab 출-퇴근 서비스</h2>
    
            <b>조회할 항목을 입력 후 확인을 누르세요</b><p>
            <form id = "search" method = "POST" action = "/search">
            날짜&nbsp; <input type = "text" name = "date" size = "20" placeholder ="YYYY-MM-DD"/><br>
            이름&nbsp; <input type = "text" name = "name"size = "20" placeholder = "이름입력"/><br>
            <input type = "submit" value = "확 인" >
            </form> 

            <table id = "TNA">
            <tbody> ` + searchstr +
            `</tbody>
            </table>
        </body>
        </html> `;
        res.end(html);
    });
});

app.use((req,res) => {
    res.sendFile(__dirname + "/public/404.html");
});

//웹서버 구동
server.listen(3000, (err) => {
    if(err) {
        return console.log(err);
    } else {
        console.log("server ready");
        condb.connect((err) => {
            if(err) {
                console.log(err);
            } else {
                console.log("DB connected");
            }
        });
    }
});

//요일정보 관련 함수
function getWeekday(sDate) {
    var yy = parseInt(sDate.substr(0, 4), 10);
    var mm = parseInt(sDate.substr(5,2), 10);
    var dd = parseInt(sDate.substr(8), 10);

    var d= new Date(yy,mm -1 , dd);
    var weekday = new Array(7);
    weekday[0] = "일";
    weekday[1] = "월";
    weekday[2] = "화";
    weekday[3] = "수";
    weekday[4] = "목";
    weekday[5] = "금";
    weekday[6] = "토";
    
    return weekday[d.getDay()];
}

function inputquery(obj) {
    console.log(obj.tna);
    var datainputquery = "INSERT INTO tna (name, date, time, tna) VALUES (\'" + obj.card_owner + "\',\'" + obj.tnadate + "\',\'" + obj.tnatime + "\',\'" + obj.tna+ "\')";
    condb.query(datainputquery, function(err,result) {
        if (err) {
            console.log(err);
        } else {
            console.log("Insert OK");
        }
    });
}