@echo off
rem Opens the local stage test (2D background as a 3D stage, click the floor to walk). Local only, not published.
rem Build it first: Unity batch -executeMethod Srpg.EditorAgent.StageBuilder.BuildLocal
cd /d "%~dp0"
if not exist "unity-prototype\Builds\StageTest\StageTest.exe" (
  echo StageTest.exe is not built yet. Ask Claude Code to build it.
  pause
  exit /b 1
)
start "" "unity-prototype\Builds\StageTest\StageTest.exe"
