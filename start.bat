@echo off
chcp 65001 > nul
cd /d "%~dp0"
title 식전영상 메이커

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/2] 처음 실행이라 필요한 파일을 설치하고 있어요. 잠시만 기다려 주세요...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo 설치에 실패했어요. 인터넷 연결을 확인하고 다시 실행해 주세요.
    pause
    exit /b 1
  )
)

echo [2/2] 사이트를 준비하고 있어요...
call npx vite build --logLevel warn
if errorlevel 1 (
  echo 사이트 준비에 실패했어요.
  pause
  exit /b 1
)

echo.
echo 식전영상 메이커가 열렸어요: http://localhost:4173/
echo 브라우저가 자동으로 열리지 않으면 위 주소를 Chrome 또는 Edge에 붙여 넣어 주세요.
echo 사용을 마치면 이 창을 닫으면 돼요.
echo.
call npx vite preview --open
