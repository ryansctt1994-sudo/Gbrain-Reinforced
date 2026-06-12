FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY proxy.py sign_receipt.py chaos_fuzzer.py mock_mcp.py ./
CMD ["python", "proxy.py"]
