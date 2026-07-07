!macro customInit
  ; 静默安装（自动升级）时保留 /D 传入的路径，不要覆盖
  ${IfNot} ${Silent}
    StrCpy $INSTDIR "D:\${APP_FILENAME}"
  ${EndIf}
!macroend
