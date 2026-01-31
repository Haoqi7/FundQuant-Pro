#!/bin/bash

# FundQuant Pro 自动化部署脚本 (V5.0 Data Separated)
APP_NAME="fund-quant-pro"
PORT=8080

echo "🚀 开始部署 $APP_NAME ..."

# 1. 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker 未运行，请先启动 Docker。"
  exit 1
fi

# 2. 停止并删除旧容器
if [ "$(docker ps -q -f name=$APP_NAME)" ]; then
    echo "🛑 停止旧容器..."
    docker stop $APP_NAME
    docker rm $APP_NAME
fi

# 3. 构建新镜像
echo "🔨 构建 Docker 镜像..."
docker build -t $APP_NAME .

# 4. 运行新容器
echo "▶️ 启动容器 (Port: $PORT)..."
# 注意：本版本采用 DataManager 模拟文件系统，数据持久化在客户端浏览器中，
# 因此不需要挂载服务器卷即可保证数据安全（清理浏览器缓存除外）。
docker run -d -p $PORT:80 --name $APP_NAME --restart always $APP_NAME

echo "✅ 部署完成!"
echo "👉 访问地址: http://localhost:$PORT"
echo "📂 数据说明: 算法数据与用户数据已逻辑分离，可在[设置]页面分别导出备份。"