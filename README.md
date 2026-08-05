# SAPUDOM Structure Analysis V1.5.2 Fix2

แก้ไขจาก V1.5.2 Fix:

- เก็บผลวิเคราะห์แยกตาม Load Case และ Load Combination ภายใน session
- สลับ DL / LL / Combination แล้วแสดงผลที่วิเคราะห์ไว้เดิมทันที
- Case ที่ยังไม่วิเคราะห์จะแจ้งให้กด Analyze โดยไม่ล้างผลของ Case อื่น
- เมื่อแก้โมเดลหรือโหลด ระบบจะล้าง cache ทั้งหมดเพื่อป้องกันผลเก่า
- แก้ Header/Toolbar ถูกบังหลัง Open JSON หรือ Cloud
- บังคับ viewport layout, resize canvas และเลื่อนกลับด้านบนหลังเปิดไฟล์
- ไม่เปลี่ยน Supabase schema และไม่ต้องรัน SQL ใหม่
