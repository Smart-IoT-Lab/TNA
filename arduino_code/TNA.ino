#include <SPI.h>
#include <MFRC522.h>
#include <SimpleTimer.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

//회로설정에 따라 가변적으로 바꿀것
#define SS_PIN 4
#define RST_PIN 5

// Instance of the class
MFRC522 rfid(SS_PIN, RST_PIN);
// Init array that will store new NUID
byte precious_cardid[4];

// WiFi 정보
const char *ssid = "";
const char *password = "";

// mosquitto server 주소
const char *mqtt_server = "";
const char *mqtt_port = "";
const char *clientName = "TNA_Arduino";

WiFiClient espClient;
PubSubClient client(espClient);

// timer 사용 선언
SimpleTimer timer;
int timerid;

void setup_wifi()
{
    delay(10);
    // Start by connecting WiFi network;
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED)
        delay(500);
    Serial.println(WiFi.localIP());
}

void reconnect()
{
    // Loop until reconnected
    while (!client.connected())
    {
        if (client.connect(clientName))
        {
            Serial.println("connected");
        }
        else
        {
            Serial.print("failled, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            // Wait 5 seconds before retrying
            delay(5000);
        }
    }
}

// Timer 초기화 함수
void refresh()
{
    for (byte i = 0; i < 4; i++)
        precious_cardid[i] = 0;
}

// MQTT 서버 데이터 전달
void send_MQTT_cardID(byte *buffer, byte bufferSize)
{
    char message[64] = "";

    sprintf(message, "{\"cardid\":%d%d%d%d}", buffer[0], buffer[1], buffer[2], buffer[3]);
    client.publish("card", message);
}

void setup()
{
    Serial.begin(115200);
    setup_wifi();
    client.setServer(mqtt_server, mqtt_port);
    SPI.begin();                                 // Init SPI bus
    rfid.PCD_Init();                             // Init MFRC522
    timerid = timer.setInterval(10000, refresh); // Init Timer (10초마다 현재 저장하고 있는 카드id 초기화)
}

void loop()
{
    if (!client.connected())
    {
        reconnect();
    }
    client.loop();

    // SimpleTimer start
    timer.run();

    // Reset the loop if no new card present on the sensor/reader. This saves the entire process when idle.
    if (!rfid.PICC_IsNewCardPresent())
        return;

    // Verify if the NUID has been readed
    if (!rfid.PICC_ReadCardSerial())
        return;

    // Check is the PICC of Classic MIFARE type
    MFRC522::PICC_Type piccType = rfid.PICC_GetType(rfid.uid.sak);
    if (piccType != MFRC522::PICC_TYPE_MIFARE_MINI &&
        piccType != MFRC522::PICC_TYPE_MIFARE_1K &&
        piccType != MFRC522::PICC_TYPE_MIFARE_4K)
    {
        return;
    }

    if (rfid.uid.uidByte[0] != precious_cardid[0] ||
        rfid.uid.uidByte[1] != precious_cardid[1] ||
        rfid.uid.uidByte[2] != precious_cardid[2] ||
        rfid.uid.uidByte[3] != precious_cardid[3])
    {
        Serial.println(F("A new card has been detected."));

        // 새 카드가 찍혔으므로 타이머 재설정
        timer.restartTimer(timerid);

        // Store NUID into precious_cardid array
        for (byte i = 0; i < 4; i++)
        {
            precious_cardid[i] = rfid.uid.uidByte[i];
        }

        // MQTT서버로 카드정보(hex값) 전송
        send_MQTT_cardID(rfid.uid.uidByte, rfid.uid.size);
        Serial.println();
    }
    else
        Serial.println(F("Card read previously."));

    // Halt PICC
    rfid.PICC_HaltA();

    // Stop encryption on PCD
    rfid.PCD_StopCrypto1();
}
