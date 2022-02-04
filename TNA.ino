#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
 
MFRC522 rfid(SS_PIN, RST_PIN); // Instance of the class

int user;

void setup() { 
  Serial.begin(9600);
  SPI.begin(); // Init SPI bus
  rfid.PCD_Init(); // Init MFRC522 

//  Serial.println("CLEARDATA");
}
 
void loop() {

  // Reset the loop if no new card present on the sensor/reader. This saves the entire process when idle.
  if ( ! rfid.PICC_IsNewCardPresent())
    return;

  // Verify if the NUID has been readed
  if ( ! rfid.PICC_ReadCardSerial())
    return;

  // Check is the PICC of Classic MIFARE type
  MFRC522::PICC_Type piccType = rfid.PICC_GetType(rfid.uid.sak);
  if (piccType != MFRC522::PICC_TYPE_MIFARE_MINI &&  
    piccType != MFRC522::PICC_TYPE_MIFARE_1K &&
    piccType != MFRC522::PICC_TYPE_MIFARE_4K)
    return;
  //end 

  //태그의 고유번호 판별
  user = 0;
  
  if(rfid.uid.uidByte[0] == 0x63 &&
  rfid.uid.uidByte[1] == 0xCA &&
  rfid.uid.uidByte[2] == 0x16 &&
  rfid.uid.uidByte[3] == 0x13) {
    user = 1;
  }
  if(rfid.uid.uidByte[0] == 0x43 &&
  rfid.uid.uidByte[1] == 0xC8 &&
  rfid.uid.uidByte[2] == 0x14 &&
  rfid.uid.uidByte[3] == 0x0C) {
    user = 2;
  }

  if(user == 0) {
    return;
  }

  Serial.print("DATA,");
  
  switch(user) {
    case 1:
      Serial.print("user1");
      Serial.print(",");
      break;
    case 2:
      Serial.print("user2");
      Serial.print(",");
      break;
    default:
      return;
      break;
  }

  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.print(",");
  Serial.print("TIME");
  Serial.println();
  
  // Halt PICC
  rfid.PICC_HaltA();

  // Stop encryption on PCD
  rfid.PCD_StopCrypto1();
}
