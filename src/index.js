<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
