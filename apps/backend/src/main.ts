import { HttpErrorFilter } from "./operations/http-error.filter";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { frontendOrigins } from "./auth/production-auth-config";
import { registerPublicUploads } from "./static-uploads";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use(cookieParser());
  app.useGlobalFilters(new HttpErrorFilter());
  await registerPublicUploads(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: frontendOrigins(),
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port, process.env.HOST ?? "0.0.0.0");
  console.log(JSON.stringify({ event: "backend_listening", port }));
}

bootstrap();
