class RoadSafety:
    def __init__(self):
        self.__MotoNum = ""
        self.__MotorOffense = 0
        self.__MotorNum = "AA111AA"
        self.__MotorOffense = 100

    def RoDisplay(self):
        print("Motor Number:", self.__MotorNum)
        print("Motor Offense:", self.__MotorOffense)

    def SetRoadSafety(self, motor_num, motor_offense):
        self.__MotorNum = motor_num
        self.__MotorOffense = motor_offense


FadaFada = RoadSafety()

FadaFada.RoDisplay()

FadaFada.SetRoadSafety("BB22BB", 999)

FadaFada.RoDisplay()
