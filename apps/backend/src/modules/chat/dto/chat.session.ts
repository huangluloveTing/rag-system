import { ApiProperty } from "@nestjs/swagger";

export class SessionDto {
    @ApiProperty({ description: '会话 ID', example: 'uuid-xxx' })
    id: string;

    @ApiProperty({ description: '会话名称', example: '客户支持会话' })
    title: string;
}
    