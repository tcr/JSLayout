REM Orientation Manager
set "str1=copy "
set str1=%str1% "_layout_open.js" +
set str1=%str1% "DOMUtils.js" +
set str1=%str1% "CSSBox.js" + 
set str1=%str1% "NodeDataManager.js" +
set str1=%str1% "OrientationManager.js" +

REM Layout Manager
set str1=%str1% "ResizeObserver.js" +
set str1=%str1% "ElementTraversal.js" +
set str1=%str1% "LayoutManager.js" +
set str1=%str1% "FullLayoutManager.js" +
set str1=%str1% "_layout_close.js"
set str1=%str1% "..\layout.js"
%str1%