# PetBuddy บน Kubernetes

Manifest สำหรับรันบน Docker Desktop Kubernetes (`overlays/local`) ทุก service หากันด้วยชื่อ Kubernetes Service

| Service | ชื่อ:port | ชนิด |
| --- | --- | --- |
| frontend (nginx) | `frontend:80` (local: `localhost:8080`) | Deployment |
| API Gateway | `backend:3000` | Deployment + HPA (1 ถึง 3 pod ที่ CPU 70%) |
| Review service | `review:3001` | Deployment (local: 2 replica) |
| Recommender | `recommender:50051` | Deployment (local: 2 replica, rating cache อยู่ใน Supabase PostgreSQL) |
| RabbitMQ | `rabbitmq:5672` | StatefulSet + PVC |

## รันบน Docker Desktop

1. เปิด Kubernetes ใน Docker Desktop: **Settings → Kubernetes → Enable Kubernetes** เลือกแบบ **kubeadm** เพราะใช้ image ที่ build ในเครื่องได้ตรงๆ
2. สลับ context และเช็คก่อนทุกครั้ง ห้าม apply ลง cluster อื่น
   ```powershell
   kubectl config use-context docker-desktop
   kubectl config current-context   # ต้องได้ docker-desktop
   ```
3. Build image จาก root ของ repo
   ```powershell
   docker build -f backend/Dockerfile -t petbuddy/backend:dev .
   docker build -f review/Dockerfile -t petbuddy/review:dev .
   docker build -f recommender/Dockerfile -t petbuddy/recommender:dev .
   docker build -f frontend/Dockerfile -t petbuddy/frontend:dev .
   ```
4. คัดลอก `overlays/local/secrets.env.example` เป็น `secrets.env` แล้วใส่ค่าจริง (git ไม่เก็บไฟล์นี้) MongoDB Atlas ต้องเพิ่ม public IP ของเครื่องใน Network Access ก่อน
5. Deploy แล้วรอให้ทุก pod เป็น Ready
   ```powershell
   kubectl apply -k k8s/addons/metrics-server-local   # ครั้งแรกครั้งเดียว HPA ต้องใช้
   kubectl apply -k k8s/overlays/local
   kubectl -n petbuddy get pods -w
   ```
6. เปิด <http://localhost:8080>

ถ้าเคย deploy recommender แบบ StatefulSet (SQLite) ไว้ก่อนหน้า ให้ลบของเก่าก่อน เพราะ `kubectl apply` จะไม่ลบให้เอง

```powershell
kubectl -n petbuddy delete statefulset recommender --ignore-not-found
kubectl -n petbuddy delete service recommender-headless --ignore-not-found
kubectl -n petbuddy delete pvc data-recommender-0 --ignore-not-found
```
