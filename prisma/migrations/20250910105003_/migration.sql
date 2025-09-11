/*
  Warnings:

  - A unique constraint covering the columns `[userId,roomId]` on the table `RoomMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_userId_roomId_key" ON "RoomMember"("userId", "roomId");
