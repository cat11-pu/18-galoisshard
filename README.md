# galoisshard

有限域纠删编码托盘（原生 ES 模块，零依赖）：上排六个分片卡片（四个数据块加两个校验块），点卡片把它标成丢失，点恢复按钮按范德蒙生成矩阵的域上逆把丢掉的块解回来；右侧是生成矩阵与恢复记录。

## 起服务看页面

    python3 -m http.server 8000

浏览器打开 http://127.0.0.1:8000/ 即可操作。

## 测试

    node tests/run.js

## 场景自检

    node check_sample.js
