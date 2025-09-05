"use client";

import { Button } from "./ui/button";

export default function ReturnHomeButton() {
  return (
    <Button asChild>
      <a href="/">Return home</a>
    </Button>
  );
}
