!macro customInstall
  CreateShortCut "$SMSTARTUP\ksync.lnk" "$INSTDIR\ksync.exe"
!macroend

!macro customUnInstall
  Delete "$SMSTARTUP\ksync.lnk"
!macroend

