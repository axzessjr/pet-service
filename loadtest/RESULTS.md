# ผลการวัด 14 พ.ย. 2026

วัดตาม [README.md](README.md) บน Docker Desktop Kubernetes (โน้ตบุ๊ก i9-14900HX, RAM 16 GB) ต่อ Supabase ที่ Sydney (ไปกลับครั้งละประมาณ 130 ms) และ MongoDB Atlas ตัวเลขละเอียดของแต่ละรอบอยู่ใน `results/<รอบ>/summary.md`

## Load test

| รอบ | Users | req/s สูงสุด (30 s) | Map p95 | Error | ผล NFR 2 |
| --- | ---: | ---: | ---: | ---: | --- |
| Load ก่อนแก้ recommender (ผลดิบไม่ได้เก็บใน repo) | 50 | 39 | 3.3 s | 21% | ไม่ผ่าน |
| **Load** | 50 | 86 | **0.82 s** | **0%** | **ผ่าน** |
| Stress (HPA 1 → 3) | 50 → 400 | 160 | 4.3 s | 15% | ไม่ผ่านตั้งแต่ 100 users |
| Stress ตรึง gateway 1 pod | 50 → 400 | 51 | 7.7 s | 0.2% | ไม่ผ่านตั้งแต่ 200 users |
| Spike | 10 → 300 → 10 | 115 | 7.1 s | 13% | ไม่ผ่านช่วง 300 users, หลังลดลง p95 0.57 s |

- **knee อยู่ราว 100 users** ตั้งแต่ 200 users throughput นิ่งที่ประมาณ 160 req/s ส่วน CPU ยังต่ำ (gateway ไม่ถึง 1 core, recommender 0.2 core) คอขวดคือการรอ Supabase ซึ่งไปกลับครั้งละ 130 ms และมี connection pool จำกัด (gateway 10 ต่อ pod, recommender 6 ต่อ pod) ถ้า gRPC รอเกิน 3 s gateway จะตอบ 503
- Spike: 290 คน login พร้อมกัน bcrypt ใช้ CPU ของ gateway pod เดียวจนเต็ม HPA จึงเพิ่มเป็น 3 pods

## QA Scalability

- HPA เพิ่ม gateway จาก 1 เป็น 3 pods: pods ใหม่ Ready ภายใน 32–39 s หลังผู้ใช้ถึง 50 คน (HPA ตัดสินใจแล้วรอ pod Ready อีกราว 10–17 s)
- throughput สูงสุด 1 pod = 51 req/s, 1 → 3 pods = 160 req/s (**3.1 เท่า**)
- ถ้าผู้ใช้เกินประมาณ 100 คน คอขวดจะย้ายไปที่ recommender กับ Supabase การเพิ่ม gateway อย่างเดียวจึงไม่พอ

## สิ่งที่เจอระหว่างวัด

1. **Gateway crash เมื่อ Supabase ตัด connection ที่ว่างอยู่** เพราะ pg Pool ไม่มีตัวดัก event `error` ทั้ง process จึงหยุด แก้แล้วใน `backend/src/database/database.module.ts`
2. **Recommender ไปกลับ Supabase 3 รอบต่อ query** (BEGIN, SELECT, ROLLBACK ใช้ 410 ms) เพราะไม่ได้เปิด autocommit แก้แล้วใน `recommender/store.py` เหลือรอบเดียว (129 ms) map p95 ที่ 50 users ลดจาก 3.3 s เหลือ 0.82 s
3. **ยังไม่แก้ (risk R5):** map กลับมาใช้ได้ช้ากว่าที่ recommender พร้อม (สูงสุด 27 s หลัง pod Ready, วัดตอนทดสอบ reliability ซึ่งย้ายออกจาก repo แล้ว) เพราะ gRPC client ใน gateway รอนานขึ้นเรื่อยๆ ก่อนต่อใหม่ (grpc-js default สูงสุด 120 s) แก้ได้โดยตั้ง `grpc.max_reconnect_backoff_ms` ใน `backend/src/recommendation/recommendation.module.ts`
4. k6 ไม่ยอมจบตราบที่แท็บ dashboard ยังเปิดอยู่ จึงให้ `run.ps1` ต่อผ่าน `dashboard-proxy.mjs` แล้วปิด proxy เมื่อ export รายงานเสร็จ
