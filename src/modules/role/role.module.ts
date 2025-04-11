import { Module } from "@nestjs/common";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";
import { UsersModule } from "../users/users.module";



@Module({
  imports: [UsersModule],
  controllers: [RoleController],
  providers: [RoleService],
})

export class RoleModule { }