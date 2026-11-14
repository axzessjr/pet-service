# Load test และ QA (Scalability)

วัดระบบที่ deploy อยู่บน Docker Desktop Kubernetes ตาม [k8s/README.md](../k8s/README.md) ผลทุกตัวใช้ในสไลด์ Load test, QA และ Risk matrix

## วัดไปเพื่ออะไร

| การวัด | คำถามที่ต้องตอบ | ตัวเลขที่ใช้ | ใช้ในสไลด์ |
| --- | --- | --- | --- |
| **Load** 50 users, คงที่ 2 นาที | ช่วงที่คนใช้พร้อมกันตามปกติ ระบบผ่าน NFR 2 ไหม (แผนที่แนะนำบริการขึ้นใน 2 s) | p95 ของ map, error % | Load test (แถว Load) |
| **Stress** 50 → 100 → 200 → 400 users | ระบบเริ่มรับไม่ไหวที่จำนวนผู้ใช้เท่าไร (knee) และส่วนไหนตันก่อน | req/s และ p95 ทุก 30 s, CPU ของ gateway และ recommender | Load test (แถว Stress + กราฟ), Risk R3 |
| **Spike** 10 → 300 users ใน 10 s | รับคนทะลักเข้ามาพร้อมกันได้ไหม และกลับสู่ปกติเร็วแค่ไหน | p95 และ error ช่วง spike, เวลาที่ p95 กลับมาต่ำกว่า 2 s | Load test (แถว Spike) |
| **QA Scalability** | เมื่อ CPU ของ gateway เกิน 70% HPA เพิ่ม pod จริงไหม เร็วแค่ไหน และรับโหลดได้มากขึ้นจริงไหม | Stress 2 รอบ: HPA ปกติ (1 → 3 pods) เทียบกับตรึงไว้ 1 pod | QA Scalability, Risk R3 |

QA เขียนเป็น scenario ได้ตามรูปแบบนี้

| | Scalability |
| --- | --- |
| Source | ผู้ใช้หลายคนพร้อมกัน (k6) |
| Stimulus | ผู้ใช้เพิ่มจาก 50 เป็น 400 |
| Artifact | API gateway (backend) |
| Environment | Docker Desktop Kubernetes, HPA 1 ถึง 3 pods ที่ CPU 70% |
| Response | HPA เพิ่ม gateway pod และกระจายโหลด |
| Measure | เวลาตั้งแต่ CPU เกิน 70% จนมี pod ใหม่ Ready, req/s สูงสุดของ 3 pods เทียบกับ 1 pod, p95 ที่ 200 users |

## Journey ที่ k6 ยิง

แต่ละ virtual user (VU) ทำตัวเป็นเจ้าของสัตว์เลี้ยงหนึ่งคน

1. `POST /api/auth/login` ครั้งเดียวตอนเริ่ม แล้วใช้ token เดิมไปตลอด เหมือนผู้ใช้จริงที่ token อยู่ได้ 7 วัน
2. วนทำซ้ำจนจบการวัด
   - `GET /api/catalog?q=groom` ค้นบริการ
   - `GET /api/pet-profile/me` ดูสัตว์เลี้ยงของตัวเอง
   - `GET /api/recommendation/pets/:id/map` แผนที่แนะนำบริการ (เรียก recommender ผ่าน gRPC)
   - พัก 1 s (think time)

ทุก request อ่านอย่างเดียว ยกเว้น login จึงไม่ทิ้งข้อมูลไว้ใน database ที่ใช้ร่วมกับทีม ตัวเลขแยกตาม route ด้วย tag `name` (`login`, `catalog`, `pet_profile`, `map`)

## เตรียมก่อนวัด

1. เปิด Docker Desktop และ Kubernetes แล้วเช็คว่าทุก pod Ready และ recommender มี 2/2
   ```powershell
   kubectl config current-context   # ต้องได้ docker-desktop
   kubectl -n petbuddy get pods
   ```
2. คัดลอก `loadtest/secrets.env.example` เป็น `loadtest/secrets.env` แล้วใส่ email และ password ของบัญชีที่มีสัตว์เลี้ยงอย่างน้อย 1 ตัว git ไม่เก็บไฟล์นี้
3. เสียบสายชาร์จ เปิดฝาโน้ตบุ๊กไว้ และปิดโปรแกรมหนักๆ เพราะ k6 กับ cluster ใช้ CPU เครื่องเดียวกัน (`run.ps1` กันเครื่องเข้า sleep ให้แล้ว แต่ปิดฝายังทำให้เครื่อง sleep)
4. ใช้เน็ตวงที่ IP อยู่ใน Network Access ของ MongoDB Atlas
5. บอกทีมก่อนวัด เพราะ Supabase ใช้ร่วมกัน และ stress test จะทำให้ database ช้าลงช่วงที่วัด

## ขั้นตอน

รันจาก root ของ repo ตามลำดับนี้ ทั้งหมดใช้เวลาประมาณ 20 นาที ทุกรอบรอให้ gateway กลับเหลือ 1 pod ก่อนเริ่มเอง ผลอยู่ใน `loadtest/results/<ชื่อรอบ>/`

| # | คำสั่ง | เวลา | ดูอะไรใน `summary.md` |
| --- | --- | --- | --- |
| 1 | `powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile load` | 3 นาที | NFR 2 PASS/FAIL, p95 ของ map, error % |
| 2 | `powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile stress` | 5 นาที | ตารางทุก 30 s: req/s หยุดขึ้นที่กี่ users, Autoscaling timeline |
| 3 | `powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile stress -Name stress-1pod -OneGatewayPod` | 5 นาที | เทียบ req/s และ p95 กับรอบ 2 ที่ users เท่ากัน |
| 4 | `powershell -ExecutionPolicy Bypass -File loadtest/run.ps1 -Profile spike` | 3.5 นาที | p95 และ error ช่วง 300 users, ช่วงไหน p95 กลับมาต่ำกว่า 2 s |

### ดูการทำงานสดระหว่างวัด

`run.ps1` เปิดให้เองทุกรอบ (ปิดได้ด้วย `-NoDashboard`)

- **k6 dashboard** เปิดใน browser ที่ <http://localhost:5665> เมื่อ k6 อุ่นเครื่องเสร็จ มีกราฟสดของจำนวน VUs, req/s, response time และ error พอจบรอบจะบันทึกเป็น `results/<ชื่อรอบ>/report.html` เปิดดูภายหลังหรือแคปใส่สไลด์ได้ แต่ dashboard รวมทุก route เข้าด้วยกัน ตัวเลขแยกตาม route ต้องดูใน `summary.md`
  - browser ต่อ k6 ผ่าน `dashboard-proxy.mjs` เพราะ k6 จะไม่ยอมจบตราบที่แท็บ dashboard ยังเปิดอยู่ `run.ps1` จะปิด proxy ให้เองเมื่อ export รายงานเสร็จ หน้า dashboard จึงหยุดอัปเดตตอนจบรอบ ซึ่งเป็นเรื่องปกติ
- **หน้าต่าง cluster** (`watch.ps1`) แสดง HPA, pods และ CPU ทุก 2 s ใช้ดูตอน gateway เพิ่มจาก 1 เป็น 2 และ 3 pods หน้าต่างนี้ใช้ต่อในรอบถัดไปได้ ปิดด้วย Ctrl+C
- ถ้าอยากเห็นมุมผู้ใช้ เปิด <http://localhost:8080> หน้า For my pet ระหว่างวัด แล้วเลื่อนแผนที่ จะรู้สึกได้ว่าช้าลงตอนโหลดสูง

`watch.ps1 -Queue` แสดง queue ของ RabbitMQ เพิ่ม (event ที่รอและจำนวน consumer) เปิดเองได้โดยไม่ต้องรัน k6

```powershell
powershell -ExecutionPolicy Bypass -File loadtest/watch.ps1 -Queue
```

หลังรอบ 1 ถึง 4 แต่ละรอบ สรุปผลด้วย

```powershell
python loadtest/summarize.py loadtest/results/load
```

ได้ `summary.md` (ตาราง), `windows.csv` (หนึ่งแถวต่อ 30 s สำหรับทำกราฟ) และ `stats.json` (ตัวเลขชุดเดียวกันสำหรับสคริปต์) ในโฟลเดอร์เดียวกัน ทุกตัวเลขคำนวณจาก `raw.csv.gz` และไม่นับ request ช่วงอุ่นเครื่องใน `setup()`

k6 จบด้วย exit code 99 แปลว่ามี threshold ไม่ผ่าน ถือเป็นผลการวัด ไม่ใช่สคริปต์พัง

### รัน k6 ตรงๆ (ไม่ผ่าน run.ps1)

แต่ละแบบมีไฟล์ของตัวเอง ทุกไฟล์ใช้ journey เดียวกันจาก `k6/flow.js` (`journey.js` ที่ `run.ps1` ใช้ก็เรียก flow เดียวกัน)

| ไฟล์ | แบบ | เวลา |
| --- | --- | --- |
| `k6/load.js` | ขึ้นถึง 50 users แล้วค้าง 2 นาที | 2:45 |
| `k6/stress.js` | 50 → 100 → 200 → 400 users | 4:15 |
| `k6/spike.js` | 10 → 300 users ใน 10 s ค้าง 1 นาที แล้วลดกลับ | 3:00 |

ใช้ k6 ที่ติดตั้งในเครื่อง (ยิงไปที่ `http://localhost:8080`) โหลดบัญชีจาก `secrets.env` เข้า PowerShell ครั้งเดียวต่อหน้าต่าง แล้วรัน

```powershell
Get-Content loadtest/secrets.env | Where-Object { $_ -match '^\s*[A-Z0-9_]+\s*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "env:$($k.Trim())" $v.Trim() }
k6 run loadtest/k6/load.js
k6 run loadtest/k6/stress.js
k6 run loadtest/k6/spike.js
```

หรือใช้ k6 ใน Docker (ต้องบอก `BASE_URL` เพราะใน container ไม่มี `localhost:8080` ของเครื่อง)

```powershell
docker run --rm -v "${PWD}/loadtest:/loadtest" --env-file loadtest/secrets.env grafana/k6:1.0.0 run -e BASE_URL=http://host.docker.internal:8080 /loadtest/k6/load.js
```

- ระหว่างรัน terminal แสดงแถบ progress (เวลา, VUs, จำนวนรอบ) ตอนจบแสดงตาราง thresholds ✓/✗
- ถ้าอยากดูกราฟสด ตั้ง `$env:K6_WEB_DASHBOARD='true'` ก่อน `k6 run` แล้วเปิด <http://localhost:5665> ปิดแท็บเมื่อจบรอบ ไม่อย่างนั้น k6 จะไม่ยอมจบ
- แบบนี้ไม่เก็บ CPU, pods และ HPA ระหว่างวัด และไม่สร้างไฟล์สำหรับ `summarize.py` ถ้าต้องการผลไปใส่สไลด์ให้ใช้ `run.ps1`

## อ่านผล

- **ตัวเลขหลัก** คือ p95 ของ route `map` เพราะเป็นหน้าที่ผู้ใช้รอ และเป็นเกณฑ์ของ NFR 2 (p95 < 2 s, error < 1%)
- **หา knee จากตารางทุก 30 s** k6 แบบนี้เป็น closed loop: throughput ≈ users ÷ (response time + think time 1 s) ถ้า users เพิ่มแต่ req/s ไม่เพิ่มตาม และ p95 พุ่งขึ้น แปลว่าระบบอิ่มตัวแล้ว
- **ดูว่าอะไรตัน**
  - Gateway CPU สูงและ HPA เพิ่ม pod: gateway เป็นคอขวด แก้ด้วยการเพิ่ม pod
  - CPU ของ gateway และ recommender ต่ำ แต่ p95 สูง: รอ database เพราะ Supabase อยู่บน internet และ connection pool มีจำกัด (gateway 10 ต่อ pod, recommender 6 ต่อ pod)
  - map ตอบ 5xx ตอนโหลดสูง: recommender รอ connection จาก pool เกิน 5 s แล้วยอมแพ้
  - `login` ช้าตอน spike: bcrypt ใช้ CPU มากและทำงานบน event loop เดียวของ Node.js
- **Scalability** เทียบรอบ 2 กับรอบ 3 ที่ช่วง users เท่ากัน ดู req/s, p95 และเวลาจาก "CPU first at or above 70%" ถึง "gateway pods Ready 1 → 2" ใน Autoscaling timeline

## เอาผลไปใส่สไลด์

| สไลด์ | ใส่อะไร | เอามาจาก |
| --- | --- | --- |
| Load test · Setup | Environment: Docker Desktop Kubernetes บนโน้ตบุ๊ก (i9-14900HX, RAM 16 GB, Docker VM 32 CPU / 7.6 GiB), gateway 1 → 3 pods (HPA), recommender 2 pods, Supabase PostgreSQL และ MongoDB Atlas บน cloud, k6 รันบนเครื่องเดียวกัน, journey ตามหัวข้อด้านบน | README นี้ |
| Load test · Results (ตาราง) | แต่ละแถว: users สูงสุด, req/s เฉลี่ย, p95 ของ map, error % | `summary.md` หัวข้อแรกและตาราง Per route ของ load, stress, spike |
| Load test · Results (กราฟ) | p95 และ req/s ทุก 30 s ของ stress หรือภาพจาก k6 dashboard | `results/stress/windows.csv`, `results/stress/report.html` |
| QA Scalability | scenario ด้านบน + 1 pod เทียบ 1 → 3 pods และเวลาที่ HPA ตอบสนอง | `summary.md` ของ stress และ stress-1pod |
| Risk matrix R3 | จำนวน users และ req/s ที่เป็น knee และสาเหตุ | stress |

ตัวเลขเหล่านี้วัดบนโน้ตบุ๊กเครื่องเดียวที่ต่อ database บน cloud จึงเทียบตรงๆ กับผลที่เคยวัดบน VM ที่ใช้ PostgreSQL ในเครื่องไม่ได้ เวลาส่วนใหญ่ของแต่ละ request คือการรอ database บน internet
