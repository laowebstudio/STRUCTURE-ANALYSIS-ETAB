# SAPUDOM Structure Analysis V1.3

ພັດທະນາຕໍ່ຈາກ V1.2 ຕົວຈິງຂອງໂຄງການ โดยรักษา 2D Frame Solver และ Supabase Cloud เดิมไว้

## สิ่งที่เพิ่มใน V1.3
- แก้พิกัด X/Y ของ Node จาก Properties
- Duplicate Node หรือ Member (`Ctrl/Cmd + D`)
- Move ด้วยค่า dX, dY
- Mirror รอบกึ่งกลางสิ่งที่เลือกตามแกน X/Y
- Smart Snap เข้ากับแนว Node เดิม พร้อมเส้น Guide
- แสดง Dimension ความยาว Member เปิด/ปิดได้
- Undo/Redo รองรับคำสั่งใหม่
- JSON Project Version 1.3
- Supabase Config และ SQL เดิมยังใช้งานได้

## GitHub Pages
อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไปที่ root ของ Repository แล้ว Commit/Push ไป branch `main`.

## หมายเหตุทางวิศวกรรม
V1.3 ใช้ Linear Elastic 2D Frame Matrix Stiffness Solver จาก V1.2 และยังไม่รองรับ member distributed loads, member releases, P-Delta, dynamic analysis หรือ 3D analysis.
