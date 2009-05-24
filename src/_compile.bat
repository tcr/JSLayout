REM Orientation Manager
set orientation=
set orientation=%orientation% "Base.js" +
set orientation=%orientation% "DOMUtils.js" +
set orientation=%orientation% "CSSBox.js" + 
set orientation=%orientation% "NodeUserData.js" +
set orientation=%orientation% "OrientationManager.js"

REM Layout Manager
set layout=%orientation% +
set layout=%layout% "ResizeObserver.js" +
set layout=%layout% "ElementTraversal.js" +
set layout=%layout% "LayoutManager.js" +
set layout=%layout% "FullLayoutManager.js"

REM exports
copy "_orientation_open.js" + %orientation% + "_orientation_close.js" "..\orientation.js"
copy "_layout_open.js" + %layout% + "_layout_close.js" "..\layout.js"