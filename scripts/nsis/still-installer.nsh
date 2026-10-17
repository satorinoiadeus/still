# Bounded shell path copy backported from electron-builder (MIT).
!define STILL_USER_PATH_INCLUDE "${__FILEDIR__}\safe-user-path.nsh"
!macro customInstallMode
  !include "${STILL_USER_PATH_INCLUDE}"
!macroend
