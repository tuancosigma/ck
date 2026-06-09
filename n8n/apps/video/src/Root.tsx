import React from "react";
import { Composition } from "remotion";
import { FGuardPromo } from "./FGuardPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FGuardPromo"
      component={FGuardPromo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
