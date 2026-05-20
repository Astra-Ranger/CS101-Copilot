<!-- Page 1 -->

# Elegantly express good idea

## 良构抽象有助于理清思维、理解本质、表达本质

- **霍尔悖论：**（霍尔是 Tony Hoare）  
  **同样的快排算法，1960年很难讲清楚，1961年简洁易懂**
  - 1980图灵奖演说：皇帝的旧衣  
    Hoare, C. A. R. (1981). "The emperor's old clothes". Comm. ACM 24(2): 75–83.

- 1959年霍尔在莫斯科国立大学当访问学生时产生快排思想，  
  1960年在 Elliott Brothers 公司发明并实现快排算法；  
  但是，**“Very difficult to explain”** 很难向他人说明快排算法

- 1961年发表快排算法，非常简洁易懂（只有半页28行伪代码）  
  Hoare, C. A. R. (1961). "Algorithm 63: Partition". Comm. ACM. 4 (7): 321.  
  Hoare, C. A. R. (1961). "Algorithm 64: Quicksort". Comm. ACM. 4 (7): 321.

## 为什么？

因为**1961年编程语言提供了递归抽象！**

函数 quicksort 调用自身；quicksort 也是自身的模块  
这个递归程序能够无缝衔接自动执行

---

> 与教科书版本算法基本一样

**ALGORITHM 64**  
**QUICKSORT**  
C. A. R. Hoare  
Elliott Brothers Ltd., Borehamwood, Hertfordshire, Eng.

`procedure quicksort(A,M,N); value M,N; array A; integer M,N;`

circled: `quicksort`

**ALGORITHM 63**  
**PARTITION**  
C. A. R. Hoare  
Elliott Brothers Ltd., Borehamwood, Hertfordshire, Eng.

`procedure partition(A,M,N,I,J); value M,N; array A; integer M,N,I,J;`

---

<!-- Page 2 -->

# 计算机科学导论-课件3

# 计算机与计算过程-3

## 计算思维**ABC**之**C**——良构抽象：递归函数

## 麦波那契计算机：融会贯通**ABC**

徐志伟（**zxu@gbu.edu.cn 18910338695**）  
大湾区大学 信息科学技术学院

2

---

<!-- Page 3 -->

# 提纲

- 上周回顾：
  - 计算思维ABC之B（比特精准）
  - 计算思维ABC之C（良构抽象）
    - 数组与循环，姓名编码实例

- 计算思维ABC之C（良构抽象）
  - 函数：一处定义多处调用的子程序
  - 条件语句
  - 活力法之自底向上、自顶向下
  - 快速排序实例

- 斐波那契计算机
  - 最简单的计算机组成
  - 最简单的支持循环的汇编程序，及其逐步状态变换
  - 支持循环的寻址模式（base+index+offset）

## 问题场景1——日出程序

- 用函数构造SunRise5.py程序  
  落实DRY原则

## 问题场景2——快排

- 构造快速排序程序  
  fastsort[3,2,6,4,1,5] = [1,2,3,4,5,6]

知道计算思维解题的两个思路  
**自底向上、自顶向下**

知道两种“有限表无穷”思路  
**循环、递归**

## 问题场景3——最简计算机

- 通过理解斐波那契计算机，  
  综合理解ABC  
  自动执行、比特精准、良构抽象

课件中可能包含素材引用，特此致谢！

3

---

<!-- Page 4 -->

# 1. 初识函数

## 第一周实验课暴露了“重复代码”问题，违背了 **DRY** 原则

**DRY原则： Don’t Repeat Yourself**

违背该原则的重复代码，既浪费精力又容易出错

SunRise4.py有三处几乎一样的代码

---

自定义并调用函数 `printCitySunrise`，可消减重复代码

```python
def printCitySunrise(city,cityLongitude):    # SunRise5.py 包含19行代码
    baseHour, baseMinute = "07:20".split(':')  # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4   # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60       # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60      # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}"  # 输出格式是HH:MM，如10:00
    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是：\t\t\t", citySunrise)
    else:
        print("我的家乡",city,"位于东经",cityLongitude,"度， \
2022.12.05的日出时间是\t", citySunrise)      # 用了续行符

printCitySunrise("北京", 116)  # 北京位于东经116度
printCitySunrise("喀什", 76)   # 喀什位于东经76度
printCitySunrise("敦煌", 93)   # 敦煌位于东经93度
city = input("请输入你家乡的地名：")
cityLongitude = int(input("请输入你家乡的东经度数："))
printCitySunrise(city, cityLongitude)
```

---

```python
baseCity = “北京”    # SunRise4.py，包含26行代码非空行
baseLongitude = 116
base_sunrise = "07:20"
print("2022.12.05北京的日出时间是：\t\t\t", base_sunrise)

baseHour, baseMinute = base_sunrise.split(':')
baseTimeInMinute = int(baseHour)*60 + int(baseMinute)

timeDiff = (baseLongitude - 76) * 4   # 喀什位于东经76度，时差每经度增加4分钟
citySunriseInMinute = baseTimeInMinute + timeDiff
hour = citySunriseInMinute // 60                    # 抽出两位小时数值HH
minute = citySunriseInMinute % 60                   # 抽出两位分钟数值MM
citySunrise = f"{hour:02d}:{minute:02d}"            # 输出格式是HH:MM，如10:00
print("2022.12.05喀什的日出时间是：\t\t\t", citySunrise)

timeDiff = (baseLongitude - 93) * 4   # 敦煌位于东经93度，时差每经度增加4分钟
citySunriseInMinute = baseTimeInMinute + timeDiff
hour = citySunriseInMinute // 60
minute = citySunriseInMinute % 60
citySunrise = f"{hour:02d}:{minute:02d}"
print("2022.12.05敦煌的日出时间是：\t\t\t", citySunrise)

city = input("请输入你家乡的地名：")
cityLongitude = int(input("请输入你家乡的东经度数："))
timeDiff = (baseLongitude - cityLongitude) * 4   # 时差每经度增加4分钟
citySunriseInMinute = baseTimeInMinute + timeDiff
hour = citySunriseInMinute // 60
minute = citySunriseInMinute % 60
citySunrise = f"{hour:02d}:{minute:02d}"
print("我的家乡",city,"位于东经",cityLongitude,"度，2022.12.05的日出时间是\t", citySunrise)

---

<!-- Page 5 -->

# 初识函数：一处定义多处调用的子程序

- 函数定义（1处）
  - 函数签名
    - 关键字 `def`
    - 函数名 `printCitySunrise`
    - 形式参数（形参）
      - `city, cityLongitude`
    - 返回值（此例不关心）
  - 函数体
    - 语句序列（代码块）
      - 自然结束（缺省 `return`）
      - 执行 `return` 结束
    - 使用形参
      - 还可定义并使用局部变量
    - 注意签名后的冒号与缩进

```python
def printCitySunrise(city,cityLongitude):    # SunRise5.py 部分代码
    baseHour, baseMinute = "07:20".split(':')    # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4    # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60          # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60         # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}"  # 输出格式是HH:MM，如10:00
    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是：\t\t\t", citySunrise)
    else:
        print("我的家乡",city, "位于东经",cityLongitude, "度， \
2022.12.05的日出时间是\t", citySunrise)        # 用了续行符\
    return        # 本行可去掉；无返回值的return返回None
```

用户自定义的函数 **`printCitySunrise`** 的功能

- 将北京作为基准城市 `base`，给定目标城市的名字 `city` 和经度 `cityLongitude`
- 从基准城市的日出时间算出目标城市的日出时间 `citySunriseInMinute`
- 按照对人更友好的格式 `citySunrise` 打印出结果字符串
- 返回空类型值 `None`

5

---

<!-- Page 6 -->

# 初识函数定义与调用

- 函数定义（1处）
  - 函数签名
    - 关键字
    - 函数名
    - 形式参数（形参）
    - 返回值（此例不关心）
  - 函数体
    - 语句序列，使用形参
    - 注意签名后的冒号与缩进

- 函数调用（4处）
  - 实际参数（**实参**）
  - 是一个表达式
  - 可有副作用（side effects）

```python
def printCitySunrise(city,cityLongitude):    # SunRise5.py 包含19行代码
    baseHour, baseMinute = "07:20".split(':')  # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4   # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60        # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60       # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}"  # 输出格式是HH:MM，如10:00
    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是： \t\t\t", citySunrise)
    else:
        print("我的家乡",city,"位于东经",cityLongitude,"度， \
        2022.12.05的日出时间是\t", citySunrise)       # 用了续行符\

printCitySunrise(“北京”, 116) # 实参city = "北京"， cityLongitude = 116
printCitySunrise("喀什", 76)  #实参city = "喀什"， cityLongitude = 76
printCitySunrise("敦煌", 93)  #实参city = "敦煌"， cityLongitude = 93
city = input("请输入你家乡的地名： ")
cityLongitude = int(input("请输入你家乡的东经度数： "))
printCitySunrise(city, cityLongitude)

---

<!-- Page 7 -->

# 初识函数定义与调用

- 函数定义（1处）
  - 函数签名
    - 关键字
    - 函数名
    - 形式参数（形参）
    - 返回值（此例不关心）
  - 函数体
    - 语句序列，使用形参
    - 注意签名后的冒号与缩进
- 函数调用（4处）
  - 实际参数（实参）
  - 是一个表达式
  - 可有副作用（side effects）

## 函数体中还包括局部变量（local variables）

函数体中通过赋值语句定义的变量

baseHour, baseMinute, baseTimeInMinute, timeDiff,  
citySunriseInMinute, hour, minute, citySunrise

局部变量的**作用域（scope）**仅限于函数体，外面看不见

```python
def printCitySunrise(city, cityLongitude):    # SunRise5.py 包含19行代码
    baseHour, baseMinute = "07:20".split(':')  # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4    # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60       # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60      # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}“  # 输出格式是HH:MM，如10:00
    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是： \t\t\t", citySunrise)
    else:
        print(“我的家乡”,city,“位于东经”,cityLongitude,“度， \ # 用了续行符\
2022.12.05的日出时间是\t", citySunrise)
    return

printCitySunrise("北京", 116)  # 实参city = "北京"，cityLongitude = 116
printCitySunrise("喀什", 76)   #实参city = "喀什"，cityLongitude = 76
printCitySunrise("敦煌", 93)   #实参city = "敦煌"，cityLongitude = 93
city = input("请输入你家乡的地名： ")
cityLongitude = int(input("请输入你家乡的东经度数： "))
printCitySunrise(city, cityLongitude)

---

<!-- Page 8 -->

# 计算机中的函数特点： **纯函数** …

- 数学函数一般是纯函数（pure function）
  - 从输入数据产生输出数据（函数返回值）

函数定义：`+(X,Y)` 返回 `X+Y` 的值  
函数调用 `+(2,3)`，即 `2+3`，返回 `5`

| 输入数据 | 加法 | 输出数据 |
|---|---|---|
| 形参：`X`, `Y`<br>实参：`2`, `3` | `+` | `5`<br>返回值 |

```python
>>> def +(X,Y):
  File "<stdin>", line 1
    def +(X,Y):
        ^
SyntaxError: invalid syntax
>>>
>>> def Add(X,Y):
...   return X+Y
...
>>> Add(2,3)
5
>>>

---

<!-- Page 9 -->

# 计算机中的函数特点：**纯函数+副作用**

- 计算机中的函数更复杂， **printCitySunrise** 除了有
  - 输入数据："北京", 116
  - 输出数据（返回值）：无正常输出，返回 **None**
    - **printCitySunrise** 函数没有正常返回值
    - 对比：**int(baseHour)** 函数有返回值，即整数 **7**

- 还可能有副作用（side effect）
  - **print** 语句打印到屏幕

- 其他副作用还包括
  - 作用于参数指定的非局部数据
  - 异常处理

- 右边程序 **SunRise5.py** 屏幕输出什么？

```console
$ python3 SunRise5.py
2022.12.05北京的日出时间是：                    07:20
2022.12.05北京的日出时间是：                    07:20
None
$
```

---

函数定义：`+(X, Y)` 返回 `X+Y` 的值  
函数调用 `+(2,3)`，即 `2+3`，返回 `5`

```text
输入数据          加法              输出数据

X   2  ─────▶  +  ─────▶  5
Y   3  ─────▶

形  实          副作用              返回值
参  参
```

```python
def printCitySunrise(city, cityLongitude):    # SunRise5.py 部分代码
    baseHour, baseMinute = "07:20".split(':')  # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4    # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60    # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60    # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}"    # 输出格式是HH:MM，如10:00
    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是： \t\t\t", citySunrise)
    else:
        print("我的家乡", city, "位于东经", cityLongitude, "度， \
2022.12.05的日出时间是\t", citySunrise)    # 用了续行符\
    return    # 本行可去掉；无返回值的return返回None

printCitySunrise("北京", 116)  # 实参city = "北京"，cityLongitude = 116
print(printCitySunrise("北京", 116))

---

<!-- Page 10 -->

# 2. 初识条件语句 if-else，它用于决策，是一种控制流

- 求解 if 与冒号之间的**条件表达式**
- 如果表达式为真，执行 if 分支
- 如果表达式为假，执行 else 分支
- 分支执行完毕，执行下一语句
  - 此例为 return
- 注意冒号与缩进

```mermaid
flowchart TD
    A[citySunrise = ...] --> B{条件}
    B -->|True| C[print(f" ...]
    B -->|False| D[print(" ...]
    C --> E[return]
    D --> E
```

```python
def printCitySunrise(city,cityLongitude):      # SunRise5.py 包含19行代码
    baseHour, baseMinute = "07:20".split(':')  # 北京日出时间是07:20
    baseTimeInMinute = int(baseHour)*60 + int(baseMinute)
    timeDiff = (116 - cityLongitude)*4  # 北京位于东经116度，每经度增加4分钟
    citySunriseInMinute = baseTimeInMinute + timeDiff
    hour = citySunriseInMinute // 60          # 抽出两位小时数值HH
    minute = citySunriseInMinute % 60         # 抽出两位分钟数值MM
    citySunrise = f"{hour:02d}:{minute:02d}"  # 输出格式是HH:MM，如10:00

    if (city == "北京") or (city == "喀什") or (city == "敦煌"):
        print(f"2022.12.05{city}的日出时间是： \t\t\t", citySunrise)
    else:
        print("我的家乡",city, "位于东经",cityLongitude,"度， \
        2022.12.05的日出时间是\t", citySunrise)      # 用了续行符

    return

printCitySunrise("北京", 116)  # 实参city = "北京"， cityLongitude = 116
printCitySunrise("喀什", 76)   #实参city = "喀什"， cityLongitude = 76
printCitySunrise("敦煌", 93)   #实参city = "敦煌"， cityLongitude = 93
city = input("请输入你家乡的地名： ")
cityLongitude = int(input("请输入你家乡的东经度数： "))
printCitySunrise(city, cityLongitude)

---

<!-- Page 11 -->

# 3. 用实例解读计算思维基础方法（活力法PEPS）

- **P**：定义领域**问题**（**Problem in target domain**）
- **E**：将问题解法**建模**（**Encoding**）到赛博空间（**cyberspace**）中的计算过程，体现为算法或程序
- **PS**：计算**过程**（**Process**）在计算**系统**（**System**）上自动执行，得到问题答案
- 映射回到目标领域，看问题是否解决；没有的话开始下一次迭代

**人工**

> 人类社会各领域中的**问题 Problem**

**Target Domain**

示例：数学领域的斐波那契兔子问题

有人在2021年1月送你一对刚诞生的兔子；一对兔子出生后，从第三个月开始就每月生一对小兔子。到了第n个月，你家里有多少对兔子（记为F(n)）？

1. 容易归纳出斐波那契数列的数学公式：  
   $F(0)=0,\quad F(1)=1,\quad \text{当 } n>1 \text{ 时 } F(n)=F(n-1)+F(n-2)$

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

2. 具体问题：求F(10)，F(40)，F(1000000000)  
   十　　　　四十　　　　十亿

---

<!-- Page 12 -->

# 活力法PEPS有自底向上和自顶向下两种思路

- 人工**建模**（**Encoding**）到赛博空间

具体问题：求 **F(10)**

$$
F(n)=
\begin{cases}
0, & n=0 \\
1, & n=1 \\
F(n-1)+F(n-2), & n>1
\end{cases}
$$

| 自底向上（bottom up）建模 | 自顶向下（top down）建模 |
|---|---|
| **底 → 顶** | **顶 → 底** |
| 先求 $F(0)$、$F(1)$、$F(2)\ldots$，最后求 $F(10)$； | 先试图求 $F(10)$，过程中求 $F(9)$、$F(8)$、$\ldots$、$F(0)$ |

---

**Target Domain**

人类社会各领域中的**问题**  
**Problem**

$\longleftrightarrow$

**Encoding**  
(Modeling)  
**建模**

12

---

<!-- Page 13 -->

# <span style="color:#2b005a">3.1 活力法P<span style="color:red">E</span>PS之自底向上</span>

- 人工<span style="color:red">建模</span>（<span style="color:red">E</span>ncoding）到赛博空间

具体问题：求 **F(10)**

先求F(0)、F(1)、F(2) …，最后求F(10)

<span style="color:red; font-size:2em;">底</span>　　　　　　　　　<span style="color:red; font-size:2em;">顶</span>

\[
F(n)=
\begin{cases}
0 & n=0\\
1 & n=1\\
F(n-1)+F(n-2) & n>1
\end{cases}
\]

自底向上  
(bottom up)  
$\longleftrightarrow$  
建模

<div style="background-color:#ffff80; padding:10px; width:600px;">

F(0)= 0,  
F(1)= 1,  
F(2)= F(1)+F(0) =1+0=1  
F(3)= F(2)+F(1) = 1+1 = 2  
F(4)= F(3)+F(2) = 3  
F(5)= F(4)+F(3) = 5

</div>

人类社会各领域中的问题  
<span style="color:red">P</span>roblem

Target Domain

$\longleftrightarrow$

<span style="color:red">E</span>ncoding  
(Modeling)  
建模

计算<span style="color:red">过</span>程  
Computational <span style="color:red">P</span>rocess

计算<span style="color:red">系</span>统  
Computing <span style="color:red">S</span>ystem

赛博空间 Cyberspace

13

---

<!-- Page 14 -->

# 活力法<span style="color:red">P</span><span style="color:red">E</span>PS之自底向上

- 人工<span style="color:red">建模</span>（<span style="color:red">E</span>ncoding）到赛博空间

具体问题：求 **F(10)**

先求 F(0)、F(1)、F(2) …，最后求 F(10)

<span style="color:red;font-size:2em">底</span>　　　　　　　　　　　　　　<span style="color:red;font-size:2em">顶</span>

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自底向上  
(bottom up)  
建模

> F(0)= 0, F(1)= 1, F(2)= F(1)+F(0) =1+0 = 1,  
> F(3)= F(2)+F(1) = 2, F(4)= F(3)+F(2) = 3,  
> F(5)= F(4)+F(3) = 5, F(6)= F(5)+F(4) = 8,  
> F(7)= F(6)+F(5) = 13, F(8)= F(7)+F(6) = 21  
> F(9)= F(8)+F(7) = 34, F(10)= F(9)+F(8) = 55

---

人类社会各领域中的**问题**  
<span style="color:red">P</span>roblem

Target Domain

← **<span style="color:red">E</span>ncoding**  
(Modeling)  
建模 →

计算**过程**  
Computational <span style="color:red">P</span>rocess

计算**系统**  
Computing <span style="color:red">S</span>ystem

赛博空间 Cyberspace

14

---

<!-- Page 15 -->

# 活力法<span style="color:red">PE</span>PS之自底向上

- 人工建模（Encoding） <span style="color:red">到赛博空间</span>

具体问题：求 **F(10)**

<div align="center">

<span style="color:red; font-size:2em;">底</span>　　　　　　　　　　　　　　　<span style="color:red; font-size:2em;">顶</span>

先求 F(0)、F(1)、F(2) …，最后求 F(10)

</div>

\[
F(n)=
\begin{cases}
0 & n=0\\
1 & n=1\\
F(n-1)+F(n-2) & n>1
\end{cases}
\]

<div align="center">

自底向上  
(bottom up)  
$\Longleftrightarrow$  
**建模**

</div>

> F(0)= 0, F(1)= 1, F(2)= F(1)+F(0) =1+0 = 1,  
> F(3)= F(2)+F(1) = 2, F(4)= F(3)+F(2) = 3,  
> F(5)= F(4)+F(3) = 5, F(6)= F(5)+F(4) = 8,  
> F(7)= F(6)+F(5) = 13, F(8)= F(7)+F(6) = 21  
> F(9)= F(8)+F(7) = 34, F(10)= F(9)+F(8) = 55

> 我们已经完成  
> 建模到赛博空  
> 间的任务了吗？  
>
> 还没有。

---

```text
人类社会各领域中的问题
Problem
```

**Target Domain**

$\Longleftrightarrow$

<span style="color:red">E</span>ncoding  
(Modeling)  
**建模**

```text
计算过程
Computational Process
```

```text
计算系统
Computing System
```

赛博空间 Cyberspace

15

---

<!-- Page 16 -->

# 活力法PEPS之自底向上

- 人工建模（Encoding）到赛博空间

具体问题：求 **F(10)**

先求 F(0)、F(1)、F(2) …，最后求 F(10)

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自底向上  
(bottom up)  
建模

F(0)=0, F(1)=1, F(2)=F(1)+F(0)=1+0=1,  
F(3)=F(2)+F(1)=2, F(4)=F(3)+F(2)=3,  
F(5)=F(4)+F(3)=5, F(6)=F(5)+F(4)=8,  
F(7)=F(6)+F(5)=13, F(8)=F(7)+F(6)=21  
F(9)=F(8)+F(7)=34, F(10)=F(9)+F(8)=55

---

尚未完成  
建模到赛博空间

- 这个计算过程能够求出 **F(10)**
- 但它还是一个手工计算过程
- 我们还停在数学领域 target domain
- 需要过渡到赛博空间

---

人类社会各领域中的问题  
**Problem**

Target Domain

Encoding  
(Modeling)  
建模

计算过程  
Computational **Process**

计算系统  
Computing **System**

赛博空间 Cyberspace

16

---

<!-- Page 17 -->

# 3.2 回顾计算过程和计算机概念，活力法 PEPS

- **专用机思路**，计算过程与计算机绑死  
  **Fixed-Program Computer**

具体问题：求 **F(10)**

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自底向上  
(bottom up)  
**建模**

$$
\begin{aligned}
&F(0)=0,\ F(1)=1,\ F(2)=F(1)+F(0)=1,\\
&F(3)=F(2)+F(1)=2,\ F(4)=F(3)+F(2)=3,\\
&F(5)=F(4)+F(3)=5,\ F(6)=F(5)+F(4)=8,\\
&F(7)=F(6)+F(5)=13,\ F(8)=F(7)+F(6)=21\\
&F(9)=F(8)+F(7)=34,\ F(10)=F(9)+F(8)=55
\end{aligned}
$$

采用 9 个加法器电路，  
连接形成从 F(0)、F(1)  
求 F(10) 的绿框电路

即，输入 F(0)、F(1)，  
得到输出结果 F(10)

验算：  
输入：F(0)=0、F(1)=1  
输出：F(10)=55

电路输出：

$$
F(10)=55
$$

电路输入：

$$
F(0)=0,\quad F(1)=1
$$

中间结果：

$$
F(2),\ F(3),\ F(4),\ F(5),\ F(6),\ F(7),\ F(8),\ F(9)
$$

---

Target Domain

人类社会各领域中的**问题**  
**Problem**

$$
\Longleftrightarrow
$$

**Encoding**  
(Modeling)  
建模

---

计算**过程**  
Computational **Process**

计算**系统**  
Computing **System**

赛博空间 Cyberspace

17

---

<!-- Page 18 -->

# F10专用机

# Fixed-Program Computer

具体问题：求 **F(10)**

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

$$
\begin{aligned}
&F(0)=0,\ F(1)=1,\ F(2)=F(1)+F(0)=1,\\
&F(3)=F(2)+F(1)=2,\ F(4)=F(3)+F(2)=3,\\
&F(5)=F(4)+F(3)=5,\ F(6)=F(5)+F(4)=8,\\
&F(7)=F(6)+F(5)=13,\ F(8)=F(7)+F(6)=21\\
&F(9)=F(8)+F(7)=34,\ F(10)=F(9)+F(8)=55
\end{aligned}
$$

自底向上  
(bottom up)  
建模

---

## F10加法机 = 绿框电路

输入为 F(0) 与 F(1)，  
输出为 F(10)

## 绿框电路内部

连接 9 个加法器电路，  
自动执行了 9 个步骤

每一级加法器硬件对应着计算  
过程的一个基本步骤

---

## F10 加法机计算步骤

| 步骤 | 计算 |
|---|---|
| 第1步 | $F(0)+F(1)=F(2)=1$ |
| 第2步 | $F(2)+F(1)=F(3)=2$ |
| 第3步 | $F(2)+F(3)=F(4)=3$ |
| 第4步 | $F(4)+F(3)=F(5)=5$ |
| 第5步 | $F(4)+F(5)=F(6)=8$ |
| 第6步 | $F(6)+F(5)=F(7)=13$ |
| 第7步 | $F(6)+F(7)=F(8)=21$ |
| 第8步 | $F(8)+F(7)=F(9)=34$ |
| 第9步 | $F(8)+F(9)=F(10)=55$ |

输入：

$$
F(0)=0,\quad F(1)=1
$$

输出：

$$
F(10)=55
$$

---

## Target Domain

人类社会各领域中的问题  
**Problem**

$$
\Longleftrightarrow
$$

**Encoding**  
(Modeling)  
建模

$$
\Longleftrightarrow
$$

## Cyberspace

计算**过程**  
Computational **Process**

计算**系统**  
Computing **System**

赛博空间 Cyberspace

18

---

<!-- Page 19 -->

# F10专用机

具体问题：求**F(10)**

\[
F(n)=
\begin{cases}
0 & n=0\\
1 & n=1\\
F(n-1)+F(n-2) & n>1
\end{cases}
\]

F(0)= 0, F(1)= 1, F(2)= F(1)+F(0) = 1,  
F(3)= F(2)+F(1) = 2, F(4)= F(3)+F(2) = 3,  
F(5)= F(4)+F(3) = 5, F(6)= F(5)+F(4) = 8,  
F(7)= F(6)+F(5) = 13, F(8)= F(7)+F(6) = 21  
F(9)= F(8)+F(7) = 34, F(10)= F(9)+F(8) = 55

自底向上  
(bottom up)  
建模

---

**F10加法机**=绿框电路  
输入为F(0)与F(1)，  
输出为F(10)

## 绿框电路内部

连接9个加法器电路，  
自动执行了9个步骤

每一级加法器硬件对应着计算过程的一个基本步骤

每个步骤的语义，即每个加法器的输入输出关系，都是明确的

---

## 加法器的计算过程

| 步骤 | 输入 | 输入 | 输出 |
|---|---|---|---|
| 第9步： | F(8) | F(9) | F(10) = 55 |
| 第8步： | F(8) | F(7) | F(9) = 34 |
| 第7步： | F(6) | F(7) | F(8) = 21 |
| 第6步： | F(6) | F(5) | F(7) = 13 |
| 第5步： | F(4) | F(5) | F(6) = 8 |
| 第4步： | F(4) | F(3) | F(5) = 5 |
| 第3步： | F(2) | F(3) | F(4) = 3 |
| 第2步： | F(2) | F(1) | F(3) = 2 |
| 第1步： | F(0) | F(1) | F(2) = 1 |

\[
F(0)=0,\quad F(1)=1,\quad F(10)=55
\]

---

人类社会各领域中的**问题**  
**Problem**  
Target Domain

\[
\Longleftrightarrow
\]

**Encoding**  
(Modeling)  
建模

\[
\Longleftrightarrow
\]

计算**过程**  
Computational **Process**

计算**系统**  
Computing **System**

赛博空间 Cyberspace

19

---

<!-- Page 20 -->

# 能够推广 \(F10\) 加法器思路，求解 \(F(100)\) 吗？

可以，有两类方法：

① 采用 **99** 个加法器，<span style="color:red">硬件规模随问题 \(n\) 规模增长，</span>  
没有复用（**reuse**），不是好方法

② 仅采用 **9** 个加法器，请大家课后自行学习

```text
                         F(100)
                            ↑
                      第99个加法器  [+]
                      第98个加法器  [+]
                      第97个加法器  [+]
                            ⋮
                            ⋮
                      第5个加法器   [+]
                      第4个加法器   [+]
                      第3个加法器   [+]
                      第2个加法器   [+]
                      第1个加法器   [+]
                         ↑     ↑
                       F(0)  F(1)
```

20

---

<!-- Page 21 -->

# 用F10加法器思路求解F(100)

有两类方法：② **复用（reuse）**，硬件规模**不**随问题规模 \(n\) 增长

**反复使用F10加法器十一次**  
**记住每次输出结果 \(F(9)\)、\(F(10)\) 作为下次输入**

## 复用过程示意

| 使用次数 | 本次输入 | 本次输出（作为下次输入） | 顶部标注 |
|---:|---|---|---|
| 1 | \(F(0)=0,\ F(1)=1\) | \(F(9)=34,\ F(10)=55\) | \(F(10)=55\) |
| 2 | \(F(9)=34,\ F(10)=55\) | \(F(18)=2584,\ F(19)=4181\) | \(F(19)=4181\) |
| 3 | \(F(18)=2584,\ F(19)=4181\) | \(F(27),\ F(28)\) | \(F(28)=317811\) |
| 4 | \(F(27),\ F(28)\) | \(F(36),\ F(37)\) | \(F(37)\) |
| 5 | \(F(36),\ F(37)\) | \(F(45),\ F(46)\) | \(F(46)\) |
| 6 | \(F(45),\ F(46)\) | \(F(54),\ F(55)\) | \(F(55)\) |
| 7 | \(F(54),\ F(55)\) | \(F(63),\ F(64)\) | \(F(64)\) |
| 8 | \(F(63),\ F(64)\) | \(F(72),\ F(73)\) | \(F(73)\) |
| 9 | \(F(72),\ F(73)\) | \(F(81),\ F(82)\) | \(F(82)\) |
| 10 | \(F(81),\ F(82)\) | \(F(90),\ F(91)\) | \(F(91)\) |
| 11 | \(F(90),\ F(91)\) | \(F(99),\ F(100)\) | \(F(100)\) |

**图例：** 黄色加法器远比粉色加法器复杂。

## 陷阱（坑）

硬件规模还是**随问题规模 \(n\) 增长！**

第一次加法器的**字长**是1比特

\[
F(2)=F(1)+F(0)=1+0=1
\]

最后一次加法器的**字长**是多少？

超出64位加法器取值范围

\[
\begin{aligned}
F(100)&=F(99)+F(98)\\
&=218922995834555169026\\
&\quad+135301852344706746049\\
&=354,224,848,179,261,915,075
\end{aligned}
\]

---

<!-- Page 22 -->

# 3.3 当代计算采用**通用计算机**思路

**Stored-Program Computer，本质是复用硬件部件**

> **专用机思路作为补充**
>
> - 实现基本部件，如加法器
> - 结合通用思路，实现加速器，如 GPU

①计算机硬件：直接提供一组基本操作部件，并自动执行基本操作命令序列

- 自动执行：逐条自动读取并执行基本操作指令（即机器语言指令）

②计算机软件：使用命令序列，描述计算过程

- 这个命令序列就是程序（program）
  - 命令 = 高级语言语句（statement）、汇编语言指令（instruction）、机器语言指令（instruction）
  - 所有程序在执行前都被变换成机器语言程序，存储在计算机硬件中
- 程序像数据一样，可被存储和变换

③合起来构成**冯诺依曼模型**通用计算机

```text
> Python3 fib-10.py
F(10)= 55
>
```

- 计算机从硬盘中将两个程序读入存储器
- 处理器执行 Python3 解释器程序，解释执行 fib-10.py 程序
- 计算机输出 F(10)= 55 到显示器

```mermaid
flowchart LR
    P["处理器（P）"]
    M["存储器（M）<br/><br/>Python解释器<br/>fib-10.py"]
    IO["输入输出设备<br/>（I/O）<br/><br/>例如，<br/>键盘、鼠标<br/>显示器<br/><br/>硬盘<br/><br/>Python解释器<br/>fib-10.py"]

    P <--> M
    P <--> IO

---

<!-- Page 23 -->

# 3.4 冯诺依曼模型上的活力法 PEPS

- 在计算机上自动执行计算过程（程序）
  - 此时计算机已经定好了（冯诺依曼模型）；需要写出程序，表示计算过程

具体问题：求 **F(10)**　　　　　先求 $F(0)$、$F(1)$、$F(2)\ldots$，最后求 $F(10)$

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自底向上  
(bottom up)  
建模

```text
F(0)=0, F(1)=1, F(2)=F(1)+F(0)=1+0=1,
F(3)=F(2)+F(1)=2, F(4)=F(3)+F(2)=3,
F(5)=F(4)+F(3)=5, F(6)=F(5)+F(4)=8,
F(7)=F(6)+F(5)=13, F(8)=F(7)+F(6)=21
F(9)=F(8)+F(7)=34, F(10)=F(9)+F(8)=55
```

> 尚未完成  
> 建模到赛博空间
>
> - 这个计算过程能够求出 **F(10)**
> - 但它还是一个手工计算过程
> - 我们还停在数学领域  
>   target domain
> - 需要过渡到赛博空间

## 如何表示下标

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

也可记为

$$
f_n=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
f_{n-1}+f_{n-2} & n>1
\end{cases}
$$

```text
F(0)=0      # fib0.py, 一个错误程序
F(1)=1      # 不能赋值给函数调用F(1)
F(2)=F(1)+F(0)
F(3)=F(2)+F(1)
F(4)=F(3)+F(2)
F(5)=F(4)+F(3)
print(F(5))
```

```text
人类社会各领域中的问题
Problem
Target Domain
```

Encoding  
(Modeling)  
建模

```text
计算过程
Computational Process

计算系统：冯诺依曼模型
Computing System

赛博空间 Cyberspace

---

<!-- Page 24 -->

# 第一周 **fib10.py** 程序的教训

实践活力法 **PEPS** 的注意事项：计算机的硬件和软件都是 **有限** 的

① 计算机 **硬件** 直接提供 **有限的基本操作部件**，并逐条自动执行基本操作命令序列  
② 计算机 **软件** 用基本操作命令序列，描述计算过程

- 使用 **有限行代码**，即代码行数与问题规模无关（与斐波那契数 $F(n)$ 的 $n$ 无关）

> ① 硬件有限性原则  
> ② 软件有限性原则

```python
f0 = 0                         # 初始化F(0)步骤
f1 = 1                         # 初始化F(1)步骤
f2=f1+f0                       # 第1个加法步骤
f3=f2+f1                       # 第2个加法步骤
f4=f3+f2                       # 第3个加法步骤
f5=f4+f3                       # 第4个加法步骤
f6=f5+f4                       # 第5个加法步骤
f7=f6+f5                       # 第6个加法步骤
f8=f7+f6                       # 第7个加法步骤
f9=f8+f7                       # 第8个加法步骤
f10=f9+f8                      # 第9个加法步骤
print(f10)
```

**fib10.py** 程序的思路  
满足①，复用了加法器  
不满足②

- 求 $F(10)$ 的代码有 12 行
- 求 $F(50)$ 的代码有 52 行
- **求 $F(n)$ 的代码有 $n+2$ 行**

**仅适用于问题规模很小的场景**

---

<!-- Page 25 -->

# for循环以有限描述潜在无穷

① 计算机**硬件**直接提供<font color="red">**有限的基本操作部件**</font>，并逐条自动执行基本操作命令序列  
② 计算机**软件**用基本操作命令序列，描述计算过程

- 使用<font color="red">**有限行代码**</font>，即代码行数与问题规模无关（与斐波那契数F(n)的n无关）

> ①硬件有限性原则  
> ②软件有限性原则

## fib10.py程序满足①，但不满足②

求F(10)的代码有　　12行  
求F(50)的代码有　　52行  
**求F(n)的代码有　　n+2行**

```python
f0 = 0                    # 初始化F(0)步骤
f1 = 1                    # 初始化F(1)步骤
f2=f1+f0                  # 第1个加法步骤
f3=f2+f1                  # 第2个加法步骤
f4=f3+f2                  # 第3个加法步骤
f5=f4+f3                  # 第4个加法步骤
f6=f5+f4                  # 第5个加法步骤
f7=f6+f5                  # 第6个加法步骤
f8=f7+f6                  # 第7个加法步骤
f9=f8+f7                  # 第8个加法步骤
f10=f9+f8                 # 第9个加法步骤
print(f10)
```

**2行替换掉n-1行**

## fib.bu.py程序 <font color="red">循环</font>复用

满足①  
满足②

- 求F(10)的代码有　　　　6行
- 求F(50)的代码有　　　　6行
- **求F(n)的代码，n=5亿，有 6行**

```python
n = 10                    # 声明F(n)的n
fib =[0]*(n+1)            # 创建n+1元素数组
fib[0], fib[1] = 0, 1     # 初始化F(0)与F(1)
for i in range(2,n+1):
    fib[i] = fib[i-1] + fib[i-2]
print(f"F({n})={fib[n]}")
```

<font color="red">**Python程序如何做到的？**</font>

---

<!-- Page 26 -->

# 用列表实现元素序列，解决下标问题

- 用列表（list）构建0~n个元素的序列（sequence），用索引（index）实现下标
  - `[]`是包含0个元素的列表；`[0]`是包含1个元素的列表，该元素值为0
  - 表达式`[0]*11`，求值得到：11个元素的列表`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`，每个元素的值为0
  - 第9个加法步骤完成后，列表变量fib的值是`[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55]`
    - 其中，`fib[0]`，`fib[1]`，`fib[9]`，`fib[10]`的值分别是0，1，34，55

## fib10.py程序：硬编码下标

```python
f0 = 0                     # 初始化F(0)步骤
f1 = 1                     # 初始化F(1)步骤
f2=f1+f0                   # 第1个加法步骤
f3=f2+f1                   # 第2个加法步骤
f4=f3+f2                   # 第3个加法步骤
f5=f4+f3                   # 第4个加法步骤
f6=f5+f4                   # 第5个加法步骤
f7=f6+f5                   # 第6个加法步骤
f8=f7+f6                   # 第7个加法步骤
f9=f8+f7                   # 第8个加法步骤
f10=f9+f8                  # 第9个加法步骤
print(f10)
```

## 改进fib10.py程序：用列表索引实现下标

```python
n = 10                     # 确定F(n)的n
fib =[0]*(n+1)             # 创建11个元素的列表
fib[0], fib[1] = 0, 1      # 初始化F(0)与F(1)
fib[2] = fib[1] + fib[0]   # 第1个加法步骤
fib[3] = fib[2] + fib[1]   # 第2个加法步骤
fib[4] = fib[3] + fib[2]   # 第3个加法步骤
fib[5] = fib[4] + fib[3]   # 第4个加法步骤
fib[6] = fib[5] + fib[4]   # 第5个加法步骤
fib[7] = fib[6] + fib[5]   # 第6个加法步骤
fib[8] = fib[7] + fib[6]   # 第7个加法步骤
fib[9] = fib[8] + fib[7]   # 第8个加法步骤
fib[10] = fib[9] + fib[8]  # 第9个加法步骤
print(f"F({n})={fib[n]}")

---

<!-- Page 27 -->

# 利用循环（loop），实现代码复用，解决有限行问题

- 循环：包含若干次迭代，每次迭代行为类似
- while循环
  - 当条件成立时
    - 执行循环体代码块
    - 返回循环头
  - 条件不成立，循环结束

**fib10.py程序满足①，但不满足②**

- **求F(n)的代码有 n+2行**

```python
n = 10                         # 确定F(n)的n
fib =[0]*(n+1)                 # 创建n+1元素的列表
fib[0], fib[1] = 0, 1          # 初始化F(0)与F(1)
fib[2] = fib[1] + fib[0]       # 第1个加法步骤
fib[3] = fib[2] + fib[1]       # 第2个加法步骤
fib[4] = fib[3] + fib[2]       # 第3个加法步骤
fib[5] = fib[4] + fib[3]       # 第4个加法步骤
fib[6] = fib[5] + fib[4]       # 第5个加法步骤
fib[7] = fib[6] + fib[5]       # 第6个加法步骤
fib[8] = fib[7] + fib[6]       # 第7个加法步骤
fib[9] = fib[8] + fib[7]       # 第8个加法步骤
fib[10] = fib[9] + fib[8]      # 第9个加法步骤
print(f"F({n})={fib[n]}")
```

```python
while i < n+1 :                # 循环头，条件是i < n+1
    fib[i] = fib[i-1] + fib[i-2]   # 循环体包含2条语句
    i += 1
```

\[
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
\]

\[
f_n=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
f_{n-1}+f_{n-2} & n>1
\end{cases}
\]

**fib.bu.while.py程序 循环复用**

满足①  
满足②

- 求F(10)的代码有 8行
- 求F(50)的代码有 8行
- **求F(n)的代码有 8行**

```python
n = 10                         # 确定F(n)的n
fib =[0]*(n+1)                 # 创建n+1元素数组
fib[0], fib[1] = 0, 1          # 初始化F(0)与F(1)
i = 2
while i < n+1 :
    fib[i] = fib[i-1] + fib[i-2]
    i += 1                     # 等价于 i = i + 1
print(f"F({n})={fib[n]}")
```

**4行替换掉n-1行**

n=10时，9个加法步骤的结构不变，索引 i 改变

---

<!-- Page 28 -->

# for循环

- 根据**循环头**的指引
- 遍历索引值，  
  反复执行**循环体**
  - 每次执行称为  
    一次迭代（iteration）

> 何谓遍历（traverse，traversal）？  
> 逐个、依次、从头到尾访问序列 $(2, 3, 4, 5, 6, 7, 8, 9, 10)$ 的每个元素

**关键字　索引　range内置函数**

```python
for i in range(2,n+1):
    fib[i] = fib[i-1] + fib[i-2]
```

fib10.py程序满足①，但不满足②  
求 **F(n)** 的代码有 **n+2行**

```python
n = 10                 # 确定F(n)的n
fib =[0]*(n+1)         # 创建n+1元素的列表
fib[0], fib[1] = 0, 1  # 初始化F(0)与F(1)
fib[2] = fib[1] + fib[0]   # 第1个加法步骤
fib[3] = fib[2] + fib[1]   # 第2个加法步骤
fib[4] = fib[3] + fib[2]   # 第3个加法步骤
fib[5] = fib[4] + fib[3]   # 第4个加法步骤
fib[6] = fib[5] + fib[4]   # 第5个加法步骤
fib[7] = fib[6] + fib[5]   # 第6个加法步骤
fib[8] = fib[7] + fib[6]   # 第7个加法步骤
fib[9] = fib[8] + fib[7]   # 第8个加法步骤
fib[10] = fib[9] + fib[8]  # 第9个加法步骤
print(f"F({n})={fib[n]}")
```

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

$$
f_n=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
f_{n-1}+f_{n-2} & n>1
\end{cases}
$$

**2行替换掉n-1行**  
n=10时，9个加法步骤的结构不变，索引 **i** 改变

## fib.bu.py程序 循环复用

满足①  
满足②

- 求F(10)的代码有　　　6行
- 求F(50)的代码有　　　6行
- 求**F(n)**的代码有　　**6行**

```python
n = 10                 # 确定F(n)的n
fib =[0]*(n+1)         # 创建n+1元素数组
fib[0], fib[1] = 0, 1  # 初始化F(0)与F(1)
for i in range(2,n+1):
    fib[i] = fib[i-1] + fib[i-2]
print(f"F({n})={fib[n]}")

---

<!-- Page 29 -->

# <span style="color:#2b005b">模块化抽象——</span><span style="color:red">引入函数抽象的目的是什么？</span>

- 程序语言需提供两类功能： 完备性 + 扩展性
  - 变量声明+赋值语句+串行顺序+循环+条件语句 是 图灵完备的
    - 用这些语言结构编写的程序可算出任意可计算数（图灵完备在逻辑思维单元详述）
- 扩展性： 如何编写1000行、 1万行、 10万行的程序？
  - 应对程序复杂性需要<span style="color:red">模块、模块化</span>思想（module, modularity）
    - 将一个大程序（系统）分解成为若干模块，并复用（reuse）模块
- 函数是模块化抽象，是我们关注的三类模块之一
  - 程序包（package），包括Python社区的库（library），以及自行开发的程序包
    - 库函数（<span style="color:red">library</span> function）包括（1）内置函数，如print(); （2）导入包中的函数，如math.cos
  - 函数（function），尤其是自行开发的函数
    - 包括<span style="color:red">递归函数</span>，常常在<span style="color:red">自顶向下</span>时出现；递归函数是“有限描述无穷”的另一类抽象
      - 已经学习过“有限描述无穷”的一类抽象了，即循环；有没有第3类“有限描述无穷”的抽象？
  - 类（class）

---

<!-- Page 30 -->

# 4. 活力法PEPS之<span style="color:red">自顶向下</span>思路

- 人工定义领域<span style="color:red">问题</span>（Problem in target domain）
  - 目标领域可是任一自然科学、社会科学、数学、计算机科学的领域

- **这一阶段（问题定义阶段）没有变化**

---

**人工**

```text
人类社会各领域中
的问题 Problem
```

**Target Domain**

---

示例：数学领域的斐波那契兔子问题

有人在2021年1月送你一对刚诞生的兔子；一对兔子出生后，从第三个月开始就每月生一对小兔子。到了第n个月，你家里有多少对兔子（记为F(n)）？

斐波那契数列的数学公式：

$F(0)=0,\quad F(1)=1,\quad \text{当 } n>1 \text{ 时 } F(n)=F(n-1)+F(n-2)$

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

具体问题：求 $F(10)$，$F(100)$，$F(1000000000)$

| $F(10)$ | $F(100)$ | $F(1000000000)$ |
|---|---|---|
| 十 | 一百 | 十亿 |

30

---

<!-- Page 31 -->

# <span style="color:red">自顶向下</span>思路，在建模阶段发生了变化

- 人工<span style="color:red">建模</span>（<span style="color:red">E</span>ncoding）到赛博空间；自顶向下

具体问题：求 **F(12)，即1年后**　先试图求 F(12)，在此过程中求 F(11)、F(10)、…、F(0)

<div align="center">

<span style="color:red; font-size:1.5em;">顶</span>　　　　　　　　　　　　　　　　　　　　　　　　　<span style="color:red; font-size:1.5em;">底</span>

</div>

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自顶向下  
(top down)  
建模

---

人类社会各领域中的**问题**  
<span style="color:red">P</span>roblem

Target Domain

$\longleftrightarrow$

<span style="color:red">E</span>ncoding  
(Modeling)  
建模

$\longleftrightarrow$

计算**过程**  
Computational <span style="color:red">P</span>rocess

计算**系统**  
Computing <span style="color:red">S</span>ystem

赛博空间 Cyberspace

31

---

<!-- Page 32 -->

# 计算思维基础方法：活力法 PEPS

- 人工**建模**（**Encoding**）到赛博空间中的计算过程（**Process**），体现为程序 `fib-12.py`
  - 自顶向下较为自然：程序 `fib-12.py` 很像目标领域中的数学公式 $F(n)$
    - 采用了系统（**System**）提供的**递归**函数抽象

具体问题：求 **F(12)，F(100)，F(1000000000)**

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自顶向下  
(top down)  
建模

---

`fib-12.py` 函数定义 = 函数签名 + 函数体

```python
def f(n):    # 函数签名
    if (n==0 or n==1):
        return n
    else:
        return f(n-1)+f(n-2)

i = 12
print(f"F({i})={ f(i) }")
```

- 函数体
- 函数调用
- 函数调用不止发生在函数定义之外，`f` 的函数体调用 `f` 自身

---

人类社会各领域中的问题 **Problem**  
Target Domain

⇄ **Encoding**  
(Modeling)  
建模

计算过程  
Computational **Process**

计算系统  
Computing **System**

赛博空间 Cyberspace

32

---

<!-- Page 33 -->

# fib-12.py　函数定义=函数签名+函数体

- 采用了系统（**System**）提供的**递归**函数抽象
  - 函数体必须考虑使函数终止的基础情况（base case）以及继续调用的递归情况

具体问题：求 **F(12)**，F(100)，F(1000000000)

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自顶向下  
(top down)  
**建模**

```python
# fib-12.py

def f(n):
    if (n==0 or n==1):      # 基础情况
        return n
    else:
        return f(n-1)+f(n-2)    # 递归情况

i = 12
print(f"F({i})={ f(i) }")
```

函数终止  
基础情况  
递归情况  
继续调用

Encoding  
(Modeling)  
建模

人类社会各领域中的  
问题 **Problem**

Target Domain

计算过程  
Computational **Process**

计算系统  
Computing **System**

赛博空间 Cyberspace

33

---

<!-- Page 34 -->

# 活力法PEPS之自顶向下

- 计算**过程**（**P**rocess）在计算**系统**（**S**ystem）上自动执行，得到问题答案（演示F(12)）
- 映射回到目标领域，看问题是否解决；没有的话开始下一次迭代
  - **F(12)=144，问题解决了**

具体问题：求 **F(12)**，F(100)，F(1000000000)

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自顶向下  
(top down)  
建模

```python
# fib-12.py
def f(n):    # 函数签名
    if (n==0 or n==1):
        return n
    else:
        return f(n-1)+f(n-2)

i = 12
print(f"F({i})={ f(i) }")
```

人类社会各领域中的  
问题 Problem

Target Domain

Encoding  
(Modeling)  
建模

计算过程  
Computational Process

计算系统  
Computing System

赛博空间 Cyberspace

34

---

<!-- Page 35 -->

# 求F(100)，久久得不到结果，出问题了

- 计算**过程**（**Process**）在计算**系统**（**System**）上自动执行，得到问题答案（**演示F(100)**）
- 映射回到目标领域，看问题是否解决；没有的话开始下一次迭代
  - 添加两行装饰器代码，解决问题

具体问题：求F(12)，**F(100)**，F(1000000000)

$$
F(n)=
\begin{cases}
0 & n=0 \\
1 & n=1 \\
F(n-1)+F(n-2) & n>1
\end{cases}
$$

自顶向下  
(top down)  
建模

```python
# fib-100.py
def f(n):
    if (n==0 or n==1):
        return n
    else:
        return f(n-1)+f(n-2)

i = 100
print(f"F({i})={ f(i) }")
```

人类社会各领域中的  
问题 Problem

Target Domain

Encoding  
(Modeling)  
建模

计算过程  
Computational Process

计算系统  
Computing System

赛博空间 Cyberspace

35

---

<!-- Page 36 -->

# 5. 简版快速排序算法 fastsort

> 建议同学们在自己写的 `fastsort.py` 程序中插入打印语句，复现并理解下述变换序列

- **输入**：8元素整数列表 `d = [8 3 6 7 2 1 4 5]`
- **输出**：8元素整数列表 `d = [1 2 3 4 5 6 7 8]`
  - 元素从小到大排好序了
- **步骤**：调用 `fastsort(d)`，可能不止一个参数

函数 `fastsort(A)` 的计算过程如下：

1. 基线情况（base case），决定函数什么时候结束：  
   如果 `A` 只包含 0 个元素（如 `[]`）或 1 个元素（如 `[3]`），`fastsort(A)` 结束

2. 选择 `A` 的最后一个元素作为标杆元素，简称标杆（pivot）
   - 如列表 `[8 3 6 7 2 1 4 5]` 中的 `5`

3. 调用划分函数 `partition`
   - 将小于标杆元素的元素放入 `lowerA` 子列表（称为小数组），  
     将大于标杆元素的元素放入 `upperA` 子列表（称为大数组）

4. 递归调用 `fastsort(lowerA)`

5. 递归调用 `fastsort(upperA)`

```text
A = [8 3 6 7 2 1 4 5]
              ↓
          partition
          ↙        ↘
lowerA = [3 2 1 4]   upperA = [6 7 8]
```

```text
d = [8 3 6 7 2 1 4 5]
        ↓
d = [3 2 1 4] 5 [6 7 8]
        ↓
d = [3 2 1] 4 [] 5 [6 7 8]
```

```text
d = [] 1 [2 3] 4 5 [6 7 8]
d = 1 [2] 3 [] 4 5 [6 7 8]
d = 1 [] 2 [] 3 4 5 [6 7 8]
d = 1 2 3 4 5 [6 7] 8 []
d = 1 2 3 4 5 [6] 7 [] 8
d = 1 2 3 4 5 [] 6 [] 7 8
d = 1 2 3 4 5 6 7 8

---

<!-- Page 37 -->

# 简版快速排序程序 **fastsort.py** 的框架

## 参考教科书 **71-73页**，以及 **143页** 的 **quicksort** 算法

```python
# fastsort函数排序子列表（切片） A[p:r+1]，即 [ A[p], A[p+1], ..., A[r] ]

def fastsort(A, p, r):                # 用了教科书伪代码的记号惯例，不是A[p:r+1]
    if p < r:                         # p>=r代表什么？ A[p:r+1]已经排好序了，函数结束
        q = partition(p, r)           # A[p:r+1]被划分为A[p:q]和A[q+1:r+1]，q是标杆索引
        fastsort(A, p, q-1)           # 递归排序切片A[p:q]，即排序lowerA
        fastsort(A, q+1, r)           # 递归排序切片A[q+1:r+1]，即排序upperA


def partition(p, r):    # 双索引法要点：两个索引变量i与j相互配合，而不是一个变量
    i = p                             # 索引变量 i 起什么作用，为何初值设成p
    for j in range(p, r):             # j 遍历(p, p+1, ..., r-1)
        # 此处插入你的代码
        # 建议：如果A[j]<标杆值， A[i]与A[j]交换并更新i
        ......

    A[i], A[r] = A[r], A[i]           # A[r]是标杆； A[i]是什么？
    return i                          # 此处返回的i值是什么？


d = [8, 3, 6, 7, 2, 1, 4, 5]          # p==0, r==7
print(d)                              # Given input list: [8, 3, 6, 7, 2, 1, 4, 5]
fastsort(d, 0, len(d)-1)
print(d)                              # Output result: [1, 2, 3, 4, 5, 6, 7, 8]
```

## 首先掌握第一次 **partition** 的调用执行

```text
d = [8  3  6  7  2  1  4  5]

d = [3  2  1  4]  5  [6  7  8]

d = [3 2 1]  4  []  5  [6 7 8]

d = []  1  [2 3]  4  5  [6 7 8]
d = 1  [2]  3  []  4  5  [6 7 8]
d = 1  []  2  []  3  4  5  [6 7 8]
d = 1  2  3  4  5  [6 7]  8  []
d = 1  2  3  4  5  [6]  7  []  8
d = 1  2  3  4  5  []  6  []  7  8
d = 1  2  3  4  5  6  7  8
```

37

---

<!-- Page 38 -->

# 6. 理解最简计算机：斐波那契计算机

## 初步融会贯通计算思维 ABC：自动执行（A）、比特精准（B）与良构抽象（C）

- 倒序理解：**C→B→A，着重于 C**（计算思维的核心是抽象）
- 计算机大体上分为三层
  - 硬件、系统软件、应用软件；通过两个接口连接；此例中硬件是简化的冯诺依曼模型
- 新概念：指令与汇编语言程序、访存模式、寄存器
  - 三个**抽象**层级：Python、汇编语言、斐波那契计算机的状态转移序列
    - 斐波那契计算机如何**比特精准**地实现这段高级语言代码，包含循环和数组；同时还能忽略非本质的细节

---

## 计算机三层结构

| 层级 | 内容 |
|---|---|
| 应用软件 | `fib.bu.py` |
| 高级语言接口 |  |
| 系统软件 | Linux 操作系统，Python 解释器，Shell |
| 指令接口 | 汇编语言代码、二进制代码 |
| 硬件 | 最简计算机：斐波那契计算机 |

---

## Python 程序

```python
n = 50        # 声明F(n)的n
fib =[0]*(n+1)  # 创建n+1元素数组（列表）

fib[0] = 0
fib[1] = 1
for i in range(2,n+1):
    fib[i] = fib[i-1] + fib[i-2]

print("F(%d)=%d" %(n,fib[n]))
```

---

## 汇编语言代码

```asm
MOV 0, R1
MOV R1, M[R0]
MOV 1, R1
MOV R1, M[R0+8]
MOV 2, R2
MOV 0, R1
ADD M[R0+R2*8-16], R1
ADD M[R0+R2*8-8], R1
MOV R1, M[R0+R2*8-0]
INC R2
CMP 51, R2
JL Loop

---

<!-- Page 39 -->

# 理解斐波那契计算机

## 初步融会贯通计算思维ABC：自动执行（A）、比特精准（B）与良构抽象（C）

- 计算机**自动执行**的4行Python代码变成自动执行的12条指令，支持循环与数组
  - 更具体地认识状态机这个抽象概念，理解斐波那契计算机的一次状态变换是什么
    - 为什么一次状态变换刚好有两处变化

## 斐波那契计算机第1步之后状态

| 处理器内容 | 处理器内容 | 存储器内容 | 存储器内容 |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | **0** | **MOV 0, R1** |
| PC | **2** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | **0** | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2\*8-16], R1 |
|  |  | 14 | ADD M[R0+R2\*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2\*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 0 //fib[1] |
|  |  | 40 | 0 //fib[2] |

## 第2步之后状态

| 处理器内容 | 处理器内容 | 存储器内容 | 存储器内容 |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **4** | **2** | **MOV R1, M[R0]** |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 0 | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2\*8-16], R1 |
|  |  | 14 | ADD M[R0+R2\*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2\*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | **0** |
|  |  | 32 | 0 |
|  |  | 40 | 0 |

## 第3步之后状态

| 处理器内容 | 处理器内容 | 存储器内容 | 存储器内容 |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **6** | 2 | MOV R1, M[R0] |
| R0 | 24 | **4** | **MOV 1, R1** |
| R1 | **1** | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2\*8-16], R1 |
|  |  | 14 | ADD M[R0+R2\*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2\*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 0 //fib[1] |
|  |  | 40 | 0 //fib[2] |

39

---

<!-- Page 40 -->

# 要学术，不要学究

## 不要学究地理解**比特精准**，它是原理，不是教条八股

- 系统软件和硬件忠实地解释执行 **Python** 程序，计算过程的每一个比特都是正确的
  - 而且，此例的 **Python** 程序和汇编语言程序都实现了循环，以有限表无穷
- 但为了适配硬件、优化性能，汇编语言程序的具体细节可能有差异
  - 例如，状态机的一次状态转移，在不同抽象层次有差异
    - 此例 **Python** 程序中 **for** 循环对应的一次状态转移，是一次迭代
    - 汇编语言程序中的一次状态转移，对应着执行一条指令；一次迭代对应着执行 7 条指令（标粗）

| 层次 | 内容 |
|---|---|
| 应用软件 | fib.bu.py |
| 高级语言接口 |  |
| 系统软件 | Linux操作系统，Python解释器，Shell |
| 指令接口 | 汇编语言代码、二进制代码 |
| 硬件 | 最简计算机：斐波那契计算机 |

```python
n = 50        # 声明F(n)的n
fib =[0]*(n+1)  # 创建n+1元素数组（列表）

fib[0] = 0
fib[1] = 1
for i in range(2,n+1):
    fib[i] = fib[i-1] + fib[i-2]

print("F(%d)=%d" %(n,fib[n]))
```

```asm
MOV 0, R1
MOV R1, M[R0]
MOV 1, R1
MOV R1, M[R0+8]
MOV 2, R2
Loop:  MOV 0, R1
       ADD M[R0+R2*8-16], R1
       ADD M[R0+R2*8-8], R1
       MOV R1, M[R0+R2*8-0]
       INC R2
       CMP 51, R2
       JL Loop
```

40

---

<!-- Page 41 -->

# 6.1 斐波那契计算机（FC）

- 通过简化冯诺依曼计算机模型获得
  - 忽略冯诺依曼计算机的 I/O 子系统
  - 忽略控制器和运算器的实现
- 重点关注
  - 寄存器
    - R0，R1，R2，PC，FLAGS
  - 存储器（内存）
    - **内存地址2存放多少比特？**
  - 指令集（共有6条不同指令）
    - 程序包含12条指令
  - **寻址模式**
  - 状态：寄存器和存储器的值
    - 初始状态
    - 每一步执行后的状态

## 简化冯诺依曼计算机模型

| Processor (CPU) | Memory Bus | ~~Input & Output Devices~~ |
|---|---|---|
| Registers and ALU<br>Control Unit | Memory | ~~I/O Bus~~ |

## FC 结构示意

| Memory | Processor |
|---|---|
| **Code**<br>0<br>1<br>2<br>3<br>……<br>`MOV R1, M[R0+R2*8-16]`<br><br>---<br>0&nbsp;&nbsp;&nbsp;&nbsp;fib[0]<br>1&nbsp;&nbsp;&nbsp;&nbsp;fib[1]<br><br>**Data** | R0<br>R1<br>R2<br><br>ALU<br><br>PC<br>FLAGS<br><br>Controller |

---

<!-- Page 42 -->

# 斐波那契计算机（FC）

- 聚焦for循环代码
- 人工编译成汇编程序
  - 12条指令
- 字节寻址存储器
  - 24字节存放代码
  - 408字节存放数据，即数组fib
    - 51个元素，每个整数占8字节
- 寄存器
  - 三个64位通用寄存器R0、R1、R2，每个寄存器存放64位数
  - 程序计数器PC，存放下一条指令的地址
  - 状态寄存器FLAGS，存放指令执行的状态信息，如R2是否小于51
- 指令集（共有6条指令）
  - `MOV` to Register　　传数到某个通用寄存器
  - `MOV` to Memory　　传数到某个内存地址
  - `ADD`　　加法指令
  - `INC` Increment　　增1指令
  - `CMP` Compare　　比较指令
  - `JL` Jump if Less than　　条件跳转指令

```python
n = 50          # 声明F(n)的n
fib = [0]*(n+1) # 创建n+1元素数组
```

确定n初始值  
为fib分配内存，确定元素初始值

| for循环代码 | 汇编程序 |
|---|---|
| `fib[0] = 0` | `MOV 0, R1` |
|  | `MOV R1, M[R0]` `//R0=12 initially` |
| `fib[1] = 1` | `MOV 1, R1` |
|  | `MOV R1, M[R0+8]` |
|  | `MOV 2, R2` `// i=2` |
| `for i in range(2,n+1):` | `Loop: MOV 0, R1` `// label Loop` |
| `    fib[i] = fib[i-1] + fib[i-2]` | `ADD M[R0+R2*8-16], R1` |
|  | `ADD M[R0+R2*8-8], R1` |
|  | `MOV R1, M[R0+R2*8-0]` |
|  | `INC R2` `// i++` |
|  | `CMP 51, R2` `// i < 51?` |
|  | `JL Loop` `// Jump to Loop if Less than` |

## 存储器 Memory

| 地址 | 内容 |
|---:|---|
| 0 | Code |
| 1 | Code |
| 2 | Code |
| 3 | Code |
| ... | ...... |
|  | `MOV R1, M[R0+R2*8-16]` |
| 24 | `0`　`fib[0]` |
| 32 | `1`　`fib[1]` |
|  | Data |

## 处理器 Processor

| 部件 |
|---|
| R0 |
| R1 |
| R2 |
| ALU |
| PC |
| FLAGS |
| Controller |

42

---

<!-- Page 43 -->

# FC初始状态

基址寄存器  
R0=24

为什么？

| **寄存器内容** |  | **存储器内容** |  |  |
|---|---:|---:|---|---|
| **寄存器** | **值** | **地址** | **指令 或 数据** | **注释** |
| FLAGS |  | 0 | MOV 0, R1 | 0→R1；**每条指令占2个地址** |
| PC | **0** | 2 | MOV R1, M[R0] | R1→M[R0] |
| R0 | **24** | 4 | MOV 1, R1 | 1→R1 |
| R1 |  | 6 | MOV R1, M[R0+8] | R1→M[R0+8] |
| R2 |  | 8 | MOV 2, R2 | 2→R2 |
| R0: 基址寄存器<br>初始值=24<br><br>R1: 累加器<br>R2: 索引寄存器<br><br>地址=基址+索引*8+偏移量<br>$\text{Address}=\text{base}+\text{index}*8+\text{offset}$<br><br>fib[i-2]所在地址<br>=R0+R2*8 -16<br><br>fib[i-1]所在地址<br>=R0+R2*8 -8<br><br>fib[i]所在地址<br>=R0+R2*8 -0 |  | 10 Loop | MOV 0, R1 | 0→R1；**标签Loop=10** |
|  |  | 12 | ADD M[R0+R2*8-16], R1 | R1+ M[R0+R2*8-16] → R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 | R1+ M[R0+R2*8-8] → R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] | R1→ M[R0+R2*8-0] |
|  |  | 18 | INC R2 | R2+1→R2 |
|  |  | 20 | CMP 51, R2 | 如果R2<51，’<’→FLAGS |
|  |  | 22 | JL Loop | 如果FLAGS=’<’, Loop→PC |
|  |  | 24 | 0 | fib[0]；**每个数据占8个地址** |
|  |  | 32 | 0 | fib[1] |
|  |  | 40 | 0 | fib[2] |
|  |  | 48 | 0 | fib[3] |
|  |  | …… | 0 | …… |
|  |  | 424 | 0 | fib[50] |

12条指令构成的程序

$n=50$  
fib =[0]*(n+1)

创建包含51个64位整数元素的数组fib：  
①分配内存，  
②设初始值为0

43

---

<!-- Page 44 -->

# FC初始状态

| <span style="color:red">寄存器内容</span> |  | <span style="color:red">存储器内容</span> |  |  |
|---|---|---:|---|---|
| **寄存器** | **值** | **地址** | **指令** | **注释** |
| FLAGS |  | 0 | `MOV 0, R1` | 0→R1; |
| PC | <span style="color:red">0</span> | 2 | `MOV R1, M[R0]` | R1→M[R0] |
| R0 | <span style="color:red">24</span> | 4 | `MOV 1, R1` | 1→R1 |
| R1 |  | 6 | `MOV R1, M[R0+8]` | R1→M[R0+8] |
| R2 |  | 8 | `MOV 2, R2` | 2→R2 |
| R0: 基址寄存器<br>初始值=24<br><br>R1: 累加器<br>R2: 索引寄存器<br><br>地址= 基址+索引*8+偏移量<br>Address=base+index*8+offset<br><br>fib[i-2]所在地址<br>=R0+R2*8 -16<br><br>fib[i-1]所在地址<br>=R0+R2*8 -8<br><br>fib[i]所在地址<br>=R0+R2*8 -0 |  | 10 Loop | `MOV 0, R1` | 0→R1; |
|  |  | 12 | `ADD M[R0+R2*8-16], R1` | R1+M[R0+R2*8-16]→R1 |
|  |  | 14 | `ADD M[R0+R2*8-8], R1` | R1+M[R0+R2*8-8]→R1 |
|  |  | 16 | `MOV R1, M[R0+R2*8-0]` | R1→M[R0+R2*8-0] |
|  |  | 18 | `INC R2` | R2+1→R2 |
|  |  | 20 | `CMP 51, R2` | 如果R2<51，`<` |
|  |  | 22 | `JL Loop` | 如果FLAGS=`<` |
|  |  | 24 | 0 | fib[0]; |
|  |  | 32 | 0 | fib[1] |
|  |  | 40 | 0 | fib[2] |
|  |  | 48 | 0 | fib[3] |
|  |  | …… | 0 | …… |
|  |  | 424 | 0 | fib[50] |

fib[0] = 0

fib[1] = 1

i = 2

**M[12]是指地址为12的内存单元**

---

<!-- Page 45 -->

# 6.2 理解重点： 如何使用多条指令支持循环

- 以及数组
  - 在科学计算中， 循环和数组往往配套出现
- 注意
  - 汇编代码如何反映了循环之变与不变
  - 数组与循环如何配合

| **Python代码** | **Go代码** | **汇编语言代码** |
|---|---|---|
| <pre><code>for i in range(2,51):&#10;    fib[i] = fib[i-1] + fib[i-2]</code></pre> | <pre><code>for i := 2; i &lt; 51; i++ {&#10;    fib[i] = fib[i-1] + fib[i-2]&#10;&#10;&#10;&#10;&#10;&#10;&#10;}</code></pre> | <pre><code>MOV 2, R2              // i=2&#10;Loop: MOV 0, R1        // label Loop&#10;ADD M[R0+R2*8-16], R1&#10;ADD M[R0+R2*8-8], R1&#10;MOV R1, M[R0+R2*8-0]&#10;INC R2                // i++&#10;CMP 51, R2            // i &lt; 51?&#10;JL Loop               // if Yes, goto Loop</code></pre> |

---

<!-- Page 46 -->

text
fib[0]=0
↓
fib[1]=1
↓
i in range(2,51)
├── True → fib[i] = fib[i-1] + fib[i-2]
└── False → print
```

```text
fib[0]=0
↓
fib[1]=1
↓
i := 2
↓
i < 51
├── True → fib[i] = fib[i-1] + fib[i-2] → i = i+1
└── False → print
```

```text
MOV 0, R1
↓
MOV R1, M[R0]
↓
MOV 1, R1
↓
MOV R1, M[R0+8]
↓
MOV 2, R2
↓
Loop: MOV 0, R1
↓
ADD M[R0+R2*8-16], R1
↓
ADD M[R0+R2*8-8], R1
↓
MOV R1, M[R0+R2*8-0]
↓
INC R2
↓
CMP 51, R2
↓
JL Loop
├── True → Loop
└── False
```

# Python代码

```python
fib[0] = 0

fib[1] = 1

for i in range(2,51):
    fib[i] = fib[i-1] + fib[i-2]
```

# Go代码

```go
fib[0] = 0

fib[1] = 1

for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]
}
```

# 汇编语言代码

```asm
MOV 0, R1
MOV R1, M[R0]              //R0=12 initially
MOV 1, R1
MOV R1, M[R0+8]
MOV 2, R2                  // i=2
Loop:   MOV 0, R1          // label Loop
ADD M[R0+R2*8-16], R1
ADD M[R0+R2*8-8], R1
MOV R1, M[R0+R2*8-0]
INC R2                     // i++
CMP 51, R2  // i < 51?
JL Loop                    // if Yes, goto Loop
```

46

---

<!-- Page 47 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中，循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

| 高级语言代码 | 汇编代码 |
|---|---|
| ```c<br>for i := 2; i < 51; i++ {<br>    fib[i] = fib[i-1] + fib[i-2]<br><br><br><br><br><br><br>}<br>``` | ```asm<br>        MOV 2, R2              // i=2<br>Loop:   MOV 0, R1              // label Loop<br>        ADD M[R0+R2*8-16], R1<br>        ADD M[R0+R2*8-8], R1<br>        MOV R1, M[R0+R2*8-0]<br>        INC R2                  // i++<br>        CMP 51, R2              // i < 51?<br>        JL Loop                 // if Yes, goto Loop<br>``` |

---

<!-- Page 48 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中，循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

```c
for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]
}
```

```asm
MOV 2, R2                 // i=2
Loop: MOV 0, R1           // label Loop
ADD M[R0+R2*8-16], R1
ADD M[R0+R2*8-8], R1
MOV R1, M[R0+R2*8-0]
INC R2                    // i++
CMP 51, R2                // i < 51?
JL Loop                   // if Yes, goto Loop
```

循环体

---

<!-- Page 49 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中，循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

```c
for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]
}
```

```asm
        MOV 2, R2                  // i=2
Loop:   MOV 0, R1                  // label Loop
        ADD M[R0+R2*8-16], R1
        ADD M[R0+R2*8-8], R1
        MOV R1, M[R0+R2*8-0]
        INC R2                     // i++
        CMP 51, R2                 // i < 51?
        JL Loop                    // if Yes, jump to Loop
```

循环体: `MOV 0, R1` 至 `MOV R1, M[R0+R2*8-0]`

---

<!-- Page 50 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中，循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

```text
for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]

}

MOV 2, R2                         // i=2
Loop:  MOV 0, R1                  // label Loop
       ADD M[R0+R2*8-16], R1
       ADD M[R0+R2*8-8], R1
       MOV R1, M[R0+R2*8-0]
       INC R2                     // i++
       CMP 51, R2                 // i < 51?
       JL Loop                    // if Yes, goto Loop
```

循环体：`MOV 0, R1`、`ADD M[R0+R2*8-16], R1`、`ADD M[R0+R2*8-8], R1`、`MOV R1, M[R0+R2*8-0]`

---

<!-- Page 51 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中，循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

```text
for i := 2; i < 51; i++ {                         MOV 2, R2              // i=2
  fib[i] = fib[i-1] + fib[i-2]          Loop:     MOV 0, R1              // label Loop
                                      0+fib[i-2]   ADD M[R0+R2*8-16], R1
                                                   ADD M[R0+R2*8-8], R1
                                                   MOV R1, M[R0+R2*8-0]
                                                   INC R2                 // i++
                                                   CMP 51, R2             // i < 51?
                                                   JL Loop                // if Yes, goto Loop
}

---

<!-- Page 52 -->

# 理解重点： 多条指令如何支持循环

- 以及数组
  - 在科学计算中， 循环和数组往往配套出现
- 注意
  - 汇编代码如何忠实反映了循环之变与不变
  - 数组与循环如何配合

```text
for i := 2; i < 51; i++ {                              MOV 2, R2             // i=2
  fib[i] = fib[i-1] + fib[i-2]                 Loop:    MOV 0, R1             // label Loop
                                                    0+fib[i-2]                ADD M[R0+R2*8-16], R1
                                                    0+fib[i-2]+fib[i-1]       ADD M[R0+R2*8-8], R1
                                                    fib[i]=fib[i-2]+fib[i-1]  MOV R1, M[R0+R2*8-0]
                                                                              INC R2               // i++
                                                                              CMP 51, R2           // i < 51?
                                                                              JL Loop              // if Yes, goto Loop
}

---

<!-- Page 53 -->

# 6.3 计算机硬件支持 “基址索引偏移量” 寻址模式

**The base-index-offset addressing mode**

- **address = base + index \* scaling factor + offset**  
  **实际地址 = 基址 + 索引 \* 比例因子 + 偏移量**

- 假设
  - 比例因子 Scaling Factor = 8
  - 基址 Base = 0
  - 索引 Index = 1

- 则
  - When Offset = -8
    - address = 0 + 1\*8 + (-8) = 0
  - When Offset = 2
    - address = 0 + 1\*8 + 2 = 10

## A Byte Addressable 4-GB Memory

| Address | Memory |
|---:|:---:|
| 0 | |
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
|  | ... |
| 4G-3 | |
| 4G-2 | |
| 4G-1 | |

53

---

<!-- Page 54 -->

# 基址索引偏移量寻址模式　天然适配循环

- **address = base + index*8 + offset**  
  实际地址 = 基址 + 索引*比例因子 + 偏移量

- 进入 `for` 循环，`i:=2`
  - 基址寄存器 `R0=24`
  - 索引寄存器 `R2=2`
  - 比例因子 = 8，因为 `fib[i]` 是 64 位整数
  - 赋值语句 `fib[i] = fib[i-1] + fib[i-2]` 编译成

    ```asm
    MOV 0, R1
    ADD M[R0+R2*8-16], R1
    ADD M[R0+R2*8-8], R1
    MOV R1, M[R0+R2*8-0]
    ```

  - 第一条加法指令实现 `R1=0+fib[0]`

    ```text
    R1 + M[R0+R2*8-16] → R1，即
    0 + M[24+2*8-16] → R1，即 0+fib[0] → R1
    ```

  - 第二条加法指令实现 `R1=0+fib[0]+fib[1]`

    ```text
    R1 + M[R0+R2*8-8] → R1，即
    0 + M[24+2*8-8] → R1，即 0+fib[1] → R1
    ```

```c
fib[0] = 0

fib[1] = 1

for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]
}
```

```asm
MOV 0, R1
MOV R1, M[R0]        //R0=12 initially
MOV 1, R1
MOV R1, M[R0+8]
MOV 2, R2            // i:=2
MOV 0, R1            // label Loop
ADD M[R0+R2*8-16], R1
ADD M[R0+R2*8-8], R1
MOV R1, M[R0+R2*8-0]
INC R2               // i++
CMP 51, R2           // i < 51?
JL Loop              // if Yes, goto Loop
```

## Memory

| Address | Content |
|---:|---|
| 0 | Code |
| 1 | Code |
| 2 | Code |
| 3 | Code |
| ... | ... |
|  | `MOV R1, M[R0+R2*8-16]` |
| 24 | `0` `//fib[0]` |
| 32 | `1` `//fib[1]` |
|  | Data |

## Processor

| Component |
|---|
| R0 |
| R1 |
| R2 |
| ALU |
| PC |
| Controller |
| FLAGS |

---

<!-- Page 55 -->

# 基址索引偏移量寻址模式　天然适配循环

- **address = base + index\*8 + offset**  
  实际地址 = 基址 + 索引\*比例因子 + 偏移量

- 进入`for`循环，`i=2`
  - 基址寄存器`R0=24`
  - 索引寄存器`R2=2`
  - 比例因子=8，因为`fib[i]`是64位整数
  - 赋值语句`fib[i] = fib[i-1] + fib[i-2]`编译成

    ```asm
    MOV 0, R1
    ADD M[R0+R2*8-16], R1
    ADD M[R0+R2*8-8], R1
    MOV R1, M[R0+R2*8-0]
    ```

  - 第一条加法指令实现<span style="color:red">R1=0+fib[0]</span>

    ```text
    R1+ M[R0+R2*8-16] → R1，即
    0 + M[24+2*8-16] → R1，即0+fib[0] → R1
    ```

  - 第二条加法指令实现<span style="color:red">R1=0+fib[0]+fib[1]</span>

    ```text
    R1+ M[R0+R2*8-8] → R1，即
    0 + M[24+2*8-8] → R1，即0+fib[1] → R1
    ```

  - 指令`MOV`实现<span style="color:red">fib[2]=0+fib[0]+fib[1]</span>

    ```text
    R1 → M[24+2*8-0]，即1→M[40]，即1→fib[2]
    ```

## 程序

```c
fib[0] = 0

fib[1] = 1

for i := 2; i < 51; i++ {
    fib[i] = fib[i-1] + fib[i-2]
}
```

```asm
MOV 0, R1
MOV R1, M[R0]          //R0=12 initially
MOV 1, R1
MOV R1, M[R0+8]
MOV 2, R2              // i:=2
MOV 0, R1              // label Loop
ADD M[R0+R2*8-16], R1
ADD M[R0+R2*8-8], R1
MOV R1, M[R0+R2*8-0]
INC R2                 // i++
CMP 51, R2             // i < 51?
JL Loop                // if Yes, goto Loop
```

## Memory

```text
0
1
2
3   ……

Code

MOV R1, M[R0+R2*8-16]

24  0    //fib[0]
32  1    //fib[1]
40  1    //fib[2]

Data
```

## Processor

```text
R0
R1
R2

ALU

PC

FLAGS

Controller

---

<!-- Page 56 -->

# 基址索引偏移量寻址模式　天然适配数组和循环

- **address = base + index\*8 + offset**  
  实际地址 = 基址 + 索引\*比例因子 + 偏移量

- 执行后面三条指令（`INC`、`CMP`、`JL`），  
  程序跳转到标签为 `Loop` 的指令，进入下一次迭代
  - 基址寄存器 **R0=24**
  - 索引寄存器 **R2=<span style="color:red">3（变了！</span> i=3）**
  - 比例因子=8，因为 fib[i] 是64位整数，需要8个字节

- 在此轮迭代中
  - 第一条加法指令实现 <span style="color:red">R1=0+fib[1]</span>  
    R1 + M[R0+R2\*8-16] → R1，即  
    0 + M[24+<span style="color:red">3</span>\*8-16] → R1，即 0+M[32] → R1  
    即 0+fib[1] → R1，即 0+1 → R1

  - 第二条加法指令实现 <span style="color:red">R1=0+fib[1]+fib[2]</span>  
    R1 + M[R0+R2\*8-8] → R1，即  
    1 + M[24+<span style="color:red">3</span>\*8-8] → R1，即 1+M[40] → R1  
    即 1+fib[2] → R1，即 1+1 → R1

  - 指令 MOV 实现 <span style="color:red">fib[3]=0+fib[1]+fib[2]</span>  
    R1 → M[24+<span style="color:red">3</span>\*8-0]，即 2→M[48]，即 2→fib[3]

---

**<span style="color:red">Loop</span> 中的7条指令不变**  
**唯一变了的是 R2 的值**

| C 代码 | 汇编代码 |
|---|---|
| fib[0] = 0 | MOV 0, R1 |
|  | MOV R1, M[R0] //R0=12 initially |
| fib[1] = 1 | MOV 1, R1 |
|  | MOV R1, M[R0+8] |
| for i := 2; i < 51; i++ { | MOV 2, R2　// i:=2 |
| &nbsp;&nbsp;fib[i] = fib[i-1] + fib[i-2] | <span style="color:red">MOV 0, R1　// label Loop</span> |
|  | ADD M[R0+R2\*8-16], R1 |
|  | ADD M[R0+R2\*8-8], R1 |
|  | MOV R1, M[R0+R2\*8-0] |
|  | INC R2　// i++ |
|  | CMP 51, R2　// i < 51? |
| } | JL Loop　// if Yes, goto <span style="color:red">Loop</span> |

**7条指令**

---

## Memory

| 地址 | 内容 |
|---:|---|
| 0 | Code |
| 1 |  |
| 2 |  |
| 3 | …… |
|  | MOV R1, M[R0+R2\*8-16] |
| 24 | 0　//fib[0] |
| 32 | 1　//fib[1] |
| 40 | 1　//fib[2] |
| 48 | 2　//fib[3] |
|  | Data |

## Processor

- R0
- R1
- R2
- ALU
- PC
- FLAGS
- Controller

---

<!-- Page 57 -->

# 6.4 逐步验证 A step-by-step walkthrough

- 理解“计算机如何支持循环与数组”
- 验证斐波那契计算机满足冯诺依曼机五要点
  - 二进制表示
    - 满足；但是，在逐步验证过程中，人往往采用熟悉的十进制
  - P-M-I/O
    - 满足，不过忽略了 I/O 子系统
  - 存储程序计算机
    - 满足，程序存放在内存地址0~23，数据存放在地址24~431
  - 指令驱动
    - 满足，可在逐步验证中确认
  - 串行执行（对应状态机；每一步是状态机的一次状态转移，包括两处变量改变）
    - 满足，可在逐步验证中确认
    - 每一步有两处变量改变（标红）：PC与内存单元（寄存器可看成是特殊的内存单元）

---

<!-- Page 58 -->

## Step 1

| 寄存器 | 值 | 地址 | 指令 |
|---|---:|---|---|
| FLAGS |  | **0** | **MOV 0, R1** |
| PC | **2** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | **0** | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 0 //fib[1] |
|  |  | 40 | 0 //fib[2] |

## Step 2

| 寄存器 | 值 | 地址 | 指令 |
|---|---:|---|---|
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **4** | **2** | **MOV R1, M[R0]** |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 0 | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | **0** |
|  |  | 32 | 0 |
|  |  | 40 | 0 |

## Step 3

| 寄存器 | 值 | 地址 | 指令 |
|---|---:|---|---|
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **6** | 2 | MOV R1, M[R0] |
| R0 | 24 | **4** | **MOV 1, R1** |
| R1 | **1** | 6 | MOV R1, M[R0+8] |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 0 //fib[1] |
|  |  | 40 | 0 //fib[2] |

## Step 4

| 寄存器 | 值 | 地址 | 指令 |
|---|---:|---|---|
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **8** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | **6** | **MOV R1, M[R0+8]** |
| R2 |  | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | **1** //fib[1] |
|  |  | 40 | 0 //fib[2] |

---

<!-- Page 59 -->

## Step 5

| 处理器内容 |  | 存储器内容 |  |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **10** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | 6 | MOV R1, M[R0+8] |
| R2 | **2** | **8** | **MOV 2, R2** |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[0] |
|  |  | 32 | 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[1] |
|  |  | 40 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[2] |

## Step 6

| 处理器内容 |  | 存储器内容 |  |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **12** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | **0** | 6 | MOV R1, M[R0+8] |
| R2 | 2 | 8 | MOV 2, R2 |
|  |  | **10 Loop** | **MOV 0, R1** |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[0] |
|  |  | 32 | 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[1] |
|  |  | 40 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[2] |

## Step 7

| 处理器内容 |  | 存储器内容 |  |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **14** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | **0** | 6 | MOV R1, M[R0+8] |
| R2 | 2 | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | **12** | **ADD M[R0+R2*8-16], R1** |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[0] |
|  |  | 32 | 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[1] |
|  |  | 40 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[2] |

## Step 8

| 处理器内容 |  | 存储器内容 |  |
|---|---:|---|---|
| 寄存器 | 值 | 地址 | 指令 |
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **16** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | **1** | 6 | MOV R1, M[R0+8] |
| R2 | 2 | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | **14** | **ADD M[R0+R2*8-8], R1** |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[0] |
|  |  | 32 | 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[1] |
|  |  | 40 | 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;//fib[2] |

---

<!-- Page 60 -->

## Step 9

| 处理器内容（寄存器） | 值 | 存储器内容（地址） | 指令 |
|---|---:|---|---|
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **18** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | 6 | MOV R1, M[R0+8] |
| R2 | 2 | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | **16** | **MOV R1, M[R0+R2*8-0]** |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 1 //fib[1] |
|  |  | 40 | **1** //fib[2] |

## Step 10

| 处理器内容（寄存器） | 值 | 存储器内容（地址） | 指令 |
|---|---:|---|---|
| FLAGS |  | 0 | MOV 0, R1 |
| PC | **20** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | 6 | MOV R1, M[R0+8] |
| R2 | **3** | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | **18** | **INC R2** |
|  |  | 20 | CMP 51, R2 |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 1 //fib[1] |
|  |  | 40 | 1 //fib[2] |

## Step 11

| 处理器内容（寄存器） | 值 | 存储器内容（地址） | 指令 |
|---|---:|---|---|
| FLAGS | **<** | 0 | MOV 0, R1 |
| PC | **22** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | 6 | MOV R1, M[R0+8] |
| R2 | 3 | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | **20** | **CMP 51, R2** |
|  |  | 22 | JL Loop |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 1 //fib[1] |
|  |  | 40 | 1 //fib[2] |

## Step 12

| 处理器内容（寄存器） | 值 | 存储器内容（地址） | 指令 |
|---|---:|---|---|
| FLAGS | < | 0 | MOV 0, R1 |
| PC | **10** | 2 | MOV R1, M[R0] |
| R0 | 24 | 4 | MOV 1, R1 |
| R1 | 1 | 6 | MOV R1, M[R0+8] |
| R2 | 3 | 8 | MOV 2, R2 |
|  |  | 10 Loop | MOV 0, R1 |
|  |  | 12 | ADD M[R0+R2*8-16], R1 |
|  |  | 14 | ADD M[R0+R2*8-8], R1 |
|  |  | 16 | MOV R1, M[R0+R2*8-0] |
|  |  | 18 | INC R2 |
|  |  | 20 | CMP 51, R2 |
|  |  | **22** | **JL Loop** |
|  |  | 24 | 0 //fib[0] |
|  |  | 32 | 1 //fib[1] |
|  |  | 40 | 1 //fib[2] |

---

<!-- Page 61 -->

# Step 13　Step 14  
# Step 15　Step 16

## 请同学们自行补全

---

<!-- Page 62 -->

# 课程追求：珍惜时代、体认思维、学生走心、作品牵引

## 李晓明 徐志伟｜大湾区大学

---

<!-- Page 63 -->

# 自学人体计算机实验： 小班快速排序计算机

- 设计一个小班快速排序计算机，将按姓名排序变换为按身高排序
- 学习HumanSorter.ppt

**Data**

**Stepper**  **Controller**  **Monitor**

A team computer sorts a team of students: from order by name to order by height  
Photos are blurred for privacy    Photos credits: Haoming Qiu of UCAS

63

---

<!-- Page 64 -->

# 硬件设计

- 数据组：**A, B, C, D, E, F**
- 寄存器：**L, R**
  - 下图中 $L = 1,\ R = 6$
- 其他：控制器、监控器、监督器、计数器

| 名字： | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| 寄存器 | L |  |  |  |  | R |

---

<!-- Page 65 -->

# 指令集设计

| 操作码 | 操作数 | 操作数 | 解释 |
|---|---|---|---|
| select | label1 | label2 | 选区域。选最左待排序区域**[L,R]**，该区域所有人都站着，区域边界人蹲着或没有人。<br>区域存在，**L**=起始index，**R**=结束index；若 **L = R**，则跳转到 label1；若不存在这样的区域，则跳转到 label2。 |
| pivot |  |  | 选标杆。随机选择一个**[L,R]**区域内的人作为标杆，选中的人举旗。 |
| partition |  |  | 分区。在**[L,R]**区域内，以选定的标杆划分，比标杆低的人走到标杆的左侧，高的人走到标杆的右侧。 |
| squat |  |  | 在**[L,R]**区域内：<br>• 让举旗子的人放下旗子并蹲下；<br>• 若无人举旗子，则让所有人蹲下。 |
| goto | label1 |  | 跳转到label1。 |
| halt |  |  | 所有人站起来，排序结束。 |

---

<!-- Page 66 -->

# 快排程序

## “汇编语言” 程序

```text
A    B    C    D    E    F
L R
```

初始状态： 数据组依名字排好； **L=R=1**（索引寄存器指向最左单元）

| 标签 | 指令 | 注释 |
|---|---|---|
| <span style="color:#0070C0">**L1:**</span> | select <span style="color:red">**L4, L6**</span> | # 选区域；L=起始index，R=结束index。 【区域即高级编程语言中的切片】<br># 若L = R（单元素区域），则跳转到 L4<br># 若不存在待排序区域则跳转到L6;<br># 其他情况，则执行下一条指令 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| <span style="color:red">**L4:**</span> | squat | # 蹲下 |
| L5: | goto <span style="color:#0070C0">**L1**</span> | # 跳转到L1 |
| <span style="color:red">**L6:**</span> | halt | # 排序结束 |

---

<!-- Page 67 -->

# 第1步：选区域

```text
初始：

        A          B          C          D          E          F
       L R

                         ↓

选定区域：

┌──────────────────────────────────────────────────────────────┐
│   A          B          C          D          E          F    │
└──────────────────────────────────────────────────────────────┘
    L                                                  R
```

| 行号 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| L5: | goto L1 | # 跳转到L1 |
| L6: | halt | # 排序结束 |

执行后，$L = 1,\ R = 6$

---

<!-- Page 68 -->

# 第2步：
# 选标杆

## 示意图

### 选标杆前

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| 人 | 人 | 人 | 人 | 人 | 人 |

- `L` 位于 `A` 下方
- `R` 位于 `F` 下方

⬇

### 选标杆后

| A | B | C 🚩 | D | E | F |
|---|---|------|---|---|---|
| 人 | 人 | 人 | 人 | 人 | 人 |

- `L` 位于 `A` 下方
- `R` 位于 `F` 下方

## 伪代码

```text
L1:    select L4, L6    # 选区域
L2:    pivot            # 选标杆
L3:    partition        # 分区
L4:    squat            # 蹲下
L5:    goto L1          # 跳转到L1
L6:    halt             # 排序结束
```

选中了C作为标杆，C举旗子。

---

<!-- Page 69 -->

# 第3步：分区

**分区前：**

| A | B | C（标杆） | D | E | F |
|---|---|---|---|---|---|
| L |  |  |  |  | R |

⬇

**分区后：**

| F | C（标杆） | D | E | A | B |
|---|---|---|---|---|---|
| L |  |  |  |  | R |

```text
L1:  select L4, L6  # 选区域
L2:  pivot          # 选标杆
L3:  partition      # 分区
L4:  squat          # 蹲下
L5:  goto L1        # 跳转到L1
L6:  halt           # 排序结束
```

在[L,R]区域内，以选定的标杆C划分，  
比C低的到标杆的左侧，高的到标杆的右侧。  
L和R的值不变。

---

<!-- Page 70 -->

# 第4步：蹲下

| 行号 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| **L4:** | **squat** | **# 蹲下** |
| L5: | goto L1 | # 跳转到L1 |
| L6: | halt | # 排序结束 |

上方：F C D E A B  
L 在 F 下方，R 在 B 下方，C 举旗。

↓

下方：F C D E A B  
L 在 F 下方，R 在 B 下方，C 放下旗子并蹲下。

举旗子的人（C）放下旗子并蹲下。

---

<!-- Page 71 -->

# 第5步：跳转

| F | C | D | E | A | B |
|---|---|---|---|---|---|
| L |  | ↓ |  |  | R |

| F | C | D | E | A | B |
|---|---|---|---|---|---|
| L |  |  |  |  | R |

```text
L1:  select L4, L6  # 选区域
L2:  pivot          # 选标杆
L3:  partition      # 分区
L4:  squat          # 蹲下
L5:  goto L1        # 跳转到L1
L6:  halt           # 排序结束
```

下一条指令跳转到L1。数据、L和R保持不变。

---

<!-- Page 72 -->

## 第6步：选区域

上方序列：

| F | C | D | E | A | B |
|---|---|---|---|---|---|
| L |   |   |   |   | R |

向下选择新区域：

| [F] | C | D | E | A | B |
|-----|---|---|---|---|---|
| L R |   |   |   |   |   |

```text
L1:    select L4, L6   # 选区域
L2:    pivot           # 选标杆
L3:    partition       # 分区
L4:    squat           # 蹲下
L5:    goto L1         # 跳转到L1
L6:    halt            # 排序结束
```

选新区域，$L = R$，下一条指令跳转到L4。

---

<!-- Page 73 -->

# 第7步：蹲下

## 示意图

当前区域：`L` 到 `R`，区域内人物为 `F`。

排序人物顺序：

| F | C | D | E | A | B |
|---|---|---|---|---|---|

`L`、`R` 位于 `F` 下方。

↓  

执行后，`F` 蹲下：

| F | C | D | E | A | B |
|---|---|---|---|---|---|

`L`、`R` 位于 `F` 下方。

## 伪代码

```text
L1:    select L4, L6    # 选区域
L2:    pivot            # 选标杆
L3:    partition        # 分区
L4:    squat            # 蹲下
L5:    goto L1          # 跳转到L1
L6:    halt             # 排序结束
```

L到R区域内无人举旗子，则让该区域内所有人（也就是F）蹲下。

---

<!-- Page 74 -->

# 第8步：
# 跳转

```text
F    C    D    E    A    B
L R

          ↓

F    C    D    E    A    B
L R
```

```text
L1:    select L4, L6    # 选区域
L2:    pivot            # 选标杆
L3:    partition        # 分区
L4:    squat            # 蹲下
L5:    goto L1          # 跳转到L1
L6:    halt             # 排序结束
```

下一条指令跳转到L1。数据、**L**和**R**保持不变。

---

<!-- Page 75 -->

# 第9步：选区域

```text
F  C  D  E  A  B
      ↓
      [ D  E  A  B ]
        L        R
```

$$
L = 3,\ R = 6
$$

```text
L1:  select L4, L6   # 选区域
L2:  pivot           # 选标杆
L3:  partition       # 分区
L4:  squat           # 蹲下
L5:  goto L1         # 跳转到L1
L6:  halt            # 排序结束

---

<!-- Page 76 -->

# 第10步：

# 选标杆

```text
          F        C              ┌──────────────────────────────┐
                                  │   D      E      A      B     │
                                  └──────────────────────────────┘
                                      L                    R

                                             ↓

          F        C                  D      E      A      B
                                      L                    R
```

| 行 | 操作 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| L5: | goto L1 | # 跳转到L1 |
| L6: | halt | # 排序结束 |

E被选中为标杆。

---

<!-- Page 77 -->

# 第11步：分区

|      | F | C | D | E | A | B |
| ---- | - | - | - | - | - | - |
| 指针 |   |   | L |   |   | R |

↓  

|      | F | C | A | B | E | D |
| ---- | - | - | - | - | - | - |
| 指针 |   |   | L |   |   | R |

```text
L1:  select L4,L6   # 选区域
L2:  pivot          # 选标杆
L3:  partition      # 分区
L4:  squat          # 蹲下
L5:  goto L1        # 跳转到L1
L6:  halt           # 排序结束
```

在[L,R]区域内，以选定的E标杆划分，  
比E低的到标杆的左侧，高的到标杆的  
右侧。L和R的值不变。

---

<!-- Page 78 -->

# 第12步：蹲下

```text
上方：

F    C    A    B    E    D
          L              R

              ↓

下方：

F    C    A    B    E    D
          L              R
```

```text
L1:    select L4,L6    # 选区域
L2:    pivot           # 选标杆
L3:    partition       # 分区
L4:    squat           # 蹲下
L5:    goto L1         # 跳转到L1
L6:    halt            # 排序结束
```

E放下旗子并蹲下。

---

<!-- Page 79 -->

# 第13步：跳转

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L |   |   | R |

↓  

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L |   |   | R |

```text
L1:  select L4, L6    # 选区域
L2:  pivot            # 选标杆
L3:  partition        # 分区
L4:  squat            # 蹲下
L5:  goto L1          # 跳转到L1
L6:  halt             # 排序结束
```

下一条指令跳转到L1。数据、L和R保持不变。

---

<!-- Page 80 -->

# 第14步：选区域

上方排列：

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L |   |   | R |

⬇️

选中区域：

| F | C | **A** | **B** | E | D |
|---|---|-------|-------|---|---|
|   |   | L     | R     |   |   |

$L = 3,\ R = 4$

```text
L1:  select L4,L6  # 选区域
L2:  pivot         # 选标杆
L3:  partition     # 分区
L4:  squat         # 蹲下
L5:  goto L1       # 跳转到L1
L6:  halt          # 排序结束

---

<!-- Page 81 -->

# 第15步：选标杆

## 示意

- 初始顺序：F C **[A B]** E D
- 选区域：A, B
  - L：A
  - R：B
- 选标杆后：B 被选中为标杆。

## 程序

```text
L1:  select L4, L6   # 选区域
L2:  pivot           # 选标杆
L3:  partition       # 分区
L4:  squat           # 蹲下
L5:  goto L1         # 跳转到L1
L6:  halt            # 排序结束
```

B被选中为标杆。

---

<!-- Page 82 -->

# 第16步：  
# 分区

```text
上方：

F    C    A    B    E    D
          L    R

              ↓

下方：

F    C    A    B    E    D
          L    R
```

```text
L1.  select L4, L6  # 选区域
L2.  pivot          # 选标杆
L3.  partition      # 分区
L4.  squat          # 蹲下
L5.  goto L1        # 跳转到L1
L6.  halt           # 排序结束
```

在[L,R]区域内，以选定的标杆B划分，  
比B低的到标杆的左侧，高的到标杆的  
右侧。L和R的值不变。

---

<!-- Page 83 -->

# 第17步：蹲下

```text
F    C    A    B    E    D
          L    R

          ↓

F    C    A    B    E    D
          L    R
```

```text
L1:  select L4, L6   # 选区域
L2:  pivot           # 选标杆
L3:  partition       # 分区
L4:  squat           # 蹲下
L5:  goto L1         # 跳转到L1
L6:  halt            # 排序结束
```

B放下旗子并蹲下。

---

<!-- Page 84 -->

# 第18步：跳转

```text
F   C   A   B   E   D
        L   R

        ↓

F   C   A   B   E   D
        L   R
```

| 标号 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| **L5:** | **goto L1** | **# 跳转到L1** |
| L6: | halt | # 排序结束 |

下一条指令跳转到L1。数据、L和R保持不变。

---

<!-- Page 85 -->

# 第19步：选区域

**上方状态：**

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L | R |   |   |

⬇️

**选中区域：**

| F | C | **A** | B | E | D |
|---|---|---|---|---|---|
|   |   | L / R |   |   |   |

```text
L1:    select L4, L6   # 选区域
L2:    pivot           # 选标杆
L3:    partition       # 分区
L4:    squat           # 蹲下
L5:    goto L1         # 跳转到L1
L6:    halt            # 排序结束
```

本次执行后，`L = R = 3`，下一跳指令跳转到 `L4`。

---

<!-- Page 86 -->

# 第20步：蹲下

上方状态：

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L R |   |   |   |

A 被选中。

↓  

下方状态：

| F | C | A | B | E | D |
|---|---|---|---|---|---|
|   |   | L R |   |   |   |

A蹲下。

```text
L1:  select L4, L6   # 选区域
L2:  pivot           # 选标杆
L3:  partition       # 分区
L4:  squat           # 蹲下
L5:  goto L1         # 跳转到L1
L6:  halt            # 排序结束

---

<!-- Page 87 -->

# 第21步：  
# 跳转

```text
F        C        A        B        E        D
                  L   R

                   ↓

F        C        A        B        E        D
                  L   R
```

| 标签 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| **L5:** | **goto L1** | **# 跳转到L1** |
| L6: | halt | # 排序结束 |

下一条指令跳转到L1。数据、L和R保持不变。

---

<!-- Page 88 -->

# 第22步：选区域

```text
F    C    A    B    E    D
          L    R

          ↓

F    C    A    B    E   [D]
                    L    R
```

| 标签 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| L5: | goto L1 | # 跳转到L1 |
| L6: | halt | # 排序结束 |

本次执行后，$L = R = 6$，下一跳指令跳转到 L4

---

<!-- Page 89 -->

# 第23步：蹲下

```text
F    C    A    B    E    [D]
                         L R

             ↓

F    C    A    B    E     D
                         L R
```

```text
L1:  select L4,L6   # 选区域
L2:  pivot          # 选标杆
L3:  partition      # 分区
L4:  squat          # 蹲下
L5:  goto L1        # 跳转到L1
L6:  halt           # 排序结束
```

D蹲下。

---

<!-- Page 90 -->

# 第24步：跳转

上方：

| F | C | A | B | E | D |
|---|---|---|---|---|---|

L　R

↓  

下方：

| F | C | A | B | E | D |
|---|---|---|---|---|---|

L　R

| 标签 | 指令 | 注释 |
|---|---|---|
| L1: | select L4, L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| **L5:** | **goto L1** | **# 跳转到L1** |
| L6: | halt | # 排序结束 |

下一条指令跳转到L1。数据、L和R保持不变。

---

<!-- Page 91 -->

# 第25步：选区域

```
F        C        A        B        E        D
                                      L    R

                    ↓

F        C        A        B        E        D
                                      L    R
```

```text
L1:  select L4, L6   # 选区域
L2:  pivot           # 选标杆
L3:  partition       # 分区
L4:  squat           # 蹲下
L5:  goto L1         # 跳转到L1
L6:  halt            # 排序结束
```

找不到有人站着的区域，下一条指令跳转到 **L6**。

---

<!-- Page 92 -->

# 第26步：停机

```text
F        C        A        B        E        D
                                      L   R

                    ↓

F        C        A        B        E        D
                                      L   R
```

| 行号 | 指令 | 注释 |
|---|---|---|
| L1: | select L4,L6 | # 选区域 |
| L2: | pivot | # 选标杆 |
| L3: | partition | # 分区 |
| L4: | squat | # 蹲下 |
| L5: | goto L1 | # 跳转到L1 |
| <span style="color:red">L6:</span> | <span style="color:red">halt</span> | <span style="color:red"># 排序结束</span> |

所有人站起来，排序结束。

---

<!-- Page 93 -->

# 分区指令回顾：人数很多时该怎么办？

| 状态 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 初始顺序 | A | B | C 🚩 | D | E | F |
| 指针 | L |  |  |  |  | R |

⬇

| 状态 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 调整后顺序 | F | C 🚩 | D | E | A | B |
| 指针 | L |  |  |  |  | R |

假如有100个人，则会有99个人要同时和标杆进行对比，容易造成混乱！！

---

<!-- Page 94 -->

# 逐个对比

A　B　C　D　E　F

L　　　　　　　　　R

A → A  
C → C

A比C高，需要插入到C的右侧队伍

---

<!-- Page 95 -->

# 逐个对比

```text
A    B    C    D    E    F
L                         R

A ───────────────↓
C ───────↓
        A    C
```

A如何插入到C的右侧？其他人的位置需要变化吗？  
L和R的值需要变化吗？

---

<!-- Page 96 -->

# 硬件设计

- 数据组：**A, B, C, D, E, F**
- 寄存器：**L, R, <span style="color:red">P</span>**
  - 下图中 $L = P = 1,\ R = 6$
- 其他：控制器、监控器、监督器、计数器

| 名字： | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| 寄存器 | L&nbsp;&nbsp;P |  |  |  |  | R |

96

---

<!-- Page 97 -->

# 指令集设计

- 原有指令： 删除了 partition

| 操作码 | 操作数 | 操作数 | 解释 |
|---|---|---|---|
| select | label1 | label2 | 选区域。选最左待排序区域 **[L,R]**，该区域所有人都站着，区域边界人蹲着或没有人。<br>区域存在，<span style="color:red">L=P=起始index</span>，R=结束index；若 L=R，则跳转到 label1；若不存在这样的区域，则跳转到 label2。 |
| pivot |  |  | 选标杆。随机选择一个 **[L,R]** 区域内的人作为标杆，选中的人举旗。 |
| squat |  |  | 在 **[L,R]** 区域内：<br>• 让举旗子的人放下旗子并蹲下；<br>• 若无人举旗子，则让所有人蹲下。 |
| goto | label1 |  | 跳转到 label1。 |
| halt |  |  | 所有人站起来，排序结束。 |

---

<!-- Page 98 -->

# 指令集设计

- 新增指令

| 操作码 | 操作数 | 操作数 | 解释 |
|---|---|---|---|
| cmp | label1 | label2 | 比较。若 $P = R$，则跳转到label1；若P指向的人不低于R指向的人，则跳转到label2。 |
| inc | reg |  | $reg = reg + 1$。 |
| swap | reg1 | reg2 | 交换。交换reg1和reg2指向的人。reg1和reg2可以是flag，表示正在举旗子的人。 |

---

<!-- Page 99 -->

# 快排程序

## “汇编语言” 程序

A　B　C　D　E　F

L　P　　　　　　　　　　　　　　　　　　　　　　　　　R

执行“选标杆”后的状态：  
选中 C 为标杆；\(L=P=1,\ R=6\)

```text
L1:   select  L10, L12        # 选区域
L2:   pivot                   # 选标杆
L3:   swap    flag, R         # 交换标杆到R处
L4:   cmp     L9, L7          # 比较。若P = R，则跳转L9;
                              # 若P处的人不低于R处，则跳转L7

L5:   swap    P, L            # 把P和L指向的人交换位置
L6:   inc     L               # L = L + 1
L7:   inc     P               # P = P + 1
L8:   goto    L4              # 跳转
L9:   swap    flag, L         # 交换标杆到L处
L10:  squat                   # 蹲下
L11:  goto    L1              # 跳转到L1
L12:  halt                    # 排序结束

---

<!-- Page 100 -->

# 快排程序

## “汇编语言” 程序

```text
L1:    select L4, L6    # 选区域
L2:    pivot            # 选标杆
L3:    partition        # 分区
L4:    squat            # 蹲下
L5:    goto L1          # 跳转到L1
L6:    halt             # 排序结束
```

```text
L1:  select L10, L12    # 选区域
L2:  pivot              # 选标杆

L3:  swap  flag, R      # 交换标杆到R处
L4:  cmp   L9, L7       # 比较
L5:  swap  P, L         # 交换P和L处的人
L6:  inc   L            # L = L + 1
L7:  inc   P            # P = P + 1
L8:  goto  L4           # 跳转
L9:  swap  flag, L      # 交换标杆到L处

L10: squat              # 蹲下
L11: goto  L1           # 跳转到L1
L12: halt               # 排序结束
```

右框中的代码实现了原 **partition** 指令

---

<!-- Page 101 -->

# 第3步：交换

已执行了：  
第1步 “选区域”  
第2步 “选标杆”

## 交换前

| 位置 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 人 | A | B | C | D | E | F |
| 标记 | L、P |  | flag |  |  | R |

⬇

## 交换后

| 位置 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 人 | A | B | F | D | E | C |
| 标记 | L、P |  |  |  |  | flag、R |

标杆C交换到了R处。

```text
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处

---

<!-- Page 102 -->

# 第4步：比较

上方元素：A　B　F　D　E　C

指针位置：L　P　R

```text
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处
```

\(P \ne R\)，A比C高，跳转到L7。

---

<!-- Page 103 -->

# 第5步：  
# P右移1步

**移动前：**

| A | B | F | D | E | C |
|---|---|---|---|---|---|
| L、P |  |  |  |  | R |

⬇️

**移动后：**

| A | B | F | D | E | C |
|---|---|---|---|---|---|
| L | P |  |  |  | R |

| 行号 | 指令 | 注释 |
|---|---|---|
| L3 | `swap flag, R` | 交换标杆到R处 |
| L4 | `cmp L9, L7` | 比较 |
| L5 | `swap P, L` | 交换P和L处的人 |
| L6 | `inc L` | $L = L + 1$ |
| **L7** | **`inc P`** | **$P = P + 1$** |
| L8 | `goto L4` | 跳转 |
| L9 | `swap flag, L` | 交换标杆到L处 |

P 向右走了1步。

---

<!-- Page 104 -->

# 第6步：跳转

初始状态：

```text
A    B    F    D    E    C
L    P                   R
```

↓

跳转后：

```text
A    B    F    D    E    C
L    P                   R
```

```asm
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处
```

下一条指令跳转到L4。L、P、R和数据均保持不变。

---

<!-- Page 105 -->

# 第7步：
# 比较

## 示意图

- 上方人物（从左到右）：A、B、F、D、E、C
- 下方红色标记：
  - L 位于 A 下方
  - P 位于 B 下方
  - R 位于 C 下方
- 标杆 flag 位于 C 处
- 将 P 指向的 B 与 R 指向的 C 进行比较

## 代码

| 行号 | 指令 | 参数 | 注释 |
|---|---|---|---|
| L3: | swap | flag, R | # 交换标杆到R处 |
| <span style="color:red">L4:</span> | <span style="color:red">cmp</span> | <span style="color:red">L9, L7</span> | <span style="color:red"># 比较</span> |
| L5: | swap | P, L | # 交换P和L处的人 |
| L6: | inc | L | # L = L + 1 |
| L7: | inc | P | # P = P + 1 |
| L8: | goto | L4 | # 跳转 |
| L9: | swap | flag, L | # 交换标杆到L处 |

P ≠ R，B比C高，跳转到L7。

---

<!-- Page 106 -->

# 第8步：  
# P右移1步

## 移动前

| A | B | F | D | E | C |
|---|---|---|---|---|---|
| L | P |  |  |  | R |

## 移动后

| A | B | F | D | E | C |
|---|---|---|---|---|---|
| L |  | P |  |  | R |

```text
L3: swap   flag, R    # 交换标杆到R处
L4: cmp    L9, L7     # 比较
L5: swap   P, L       # 交换P和L处的人
L6: inc    L          # L = L + 1
L7: inc    P          # P = P + 1
L8: goto   L4         # 跳转
L9: swap   flag, L    # 交换标杆到L处
```

P 向右走了1步。

---

<!-- Page 107 -->

# 第9步：跳转

| 标签 | 指令 | 参数 | 注释 |
|---|---|---|---|
| L3 | swap | flag, R | # 交换标杆到R处 |
| L4 | cmp | L9, L7 | # 比较 |
| L5 | swap | P, L | # 交换P和L处的人 |
| L6 | inc | L | # $L = L + 1$ |
| L7 | inc | P | # $P = P + 1$ |
| **L8** | **goto** | **L4** | **# 跳转** |
| L9 | swap | flag, L | # 交换标杆到L处 |

| 状态 | 人员序列 | 指针 |
|---|---|---|
| 跳转前 | A, B, F, D, E, C | L 在 A 处，P 在 F 处，R 在 C 处，flag 在 C 处 |
| 跳转后 | A, B, F, D, E, C | L 在 A 处，P 在 F 处，R 在 C 处，flag 在 C 处 |

下一条指令跳转到L4。L、P、R和数据均保持不变。

---

<!-- Page 108 -->

# 第10步：比较

示意图：

- 当前队列：A　B　F　D　E　C
- 指针位置：
  - L 在 A 处
  - P 在 F 处
  - R 在 C 处
- 比较：P ≠ R，F 比 C 低，顺序执行下一条指令。

```text
L3: swap   flag, R    # 交换标杆到R处
L4: cmp    L9, L7     # 比较
L5: swap   P, L       # 交换P和L处的人
L6: inc    L          # L = L + 1
L7: inc    P          # P = P + 1
L8: goto   L4         # 跳转
L9: swap   flag, L    # 交换标杆到L处

---

<!-- Page 109 -->

# 第11步：交换

## 交换前

| 位置 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 人 | A | B | F | D | E | C |
| 指针 | L |  | P |  |  | R |

## 交换后

| 位置 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 人 | F | B | A | D | E | C |
| 指针 | L |  | P |  |  | R |

```text
L3: swap   flag, R   # 交换标杆到R处
L4: cmp    L9, L7    # 比较
L5: swap   P, L      # 交换P和L处的人
L6: inc    L         # L = L + 1
L7: inc    P         # P = P + 1
L8: goto   L4        # 跳转
L9: swap   flag, L   # 交换标杆到L处
```

L和P指向的人（即A和F）交换了位置。

---

<!-- Page 110 -->

# 第12步：
# L右移1步

```text
L3: swap   flag, R   # 交换标杆到R处
L4: cmp    L9, L7    # 比较
L5: swap   P, L      # 交换P和L处的人
L6: inc    L         # L = L + 1
L7: inc    P         # P = P + 1
L8: goto   L4        # 跳转
L9: swap   flag, L   # 交换标杆到L处
```

L右移指向B。

---

<!-- Page 111 -->

# 第13步：  
# P右移1步

```text
上方状态：
F   B   A   D   E   C
    L   P           R

↓
```

```text
下方状态：
F   B   A   D   E   C
    L       P       R
```

| 标号 | 指令 | 注释 |
|---|---|---|
| L3 | `swap flag, R` | 交换标杆到R处 |
| L4 | `cmp L9, L7` | 比较 |
| L5 | `swap P, L` | 交换P和L处的人 |
| L6 | `inc L` | $L = L + 1$ |
| **L7** | **`inc P`** | **$P = P + 1$** |
| L8 | `goto L4` | 跳转 |
| L9 | `swap flag, L` | 交换标杆到L处 |

P右移指向D。

---

<!-- Page 112 -->

# 第14步：跳转

| F | B | A | D | E | C |
|---|---|---|---|---|---|
|   | L |   | P |   | R |

↓   

| F | B | A | D | E | C |
|---|---|---|---|---|---|
|   | L |   | P |   | R |

```text
L3: swap   flag, R   # 交换标杆到R处
L4: cmp    L9, L7    # 比较
L5: swap   P, L      # 交换P和L处的人
L6: inc    L         # L = L + 1
L7: inc    P         # P = P + 1
L8: goto   L4        # 跳转
L9: swap   flag, L   # 交换标杆到L处
```

下一条指令跳转到 **L4**。L、P、R和数据均保持不变。

---

<!-- Page 113 -->

# 第15步：比较

| 上方人物 | F | B | A | D | E | C |
|---|---|---|---|---|---|---|
| 指针/标记 |  | L |  | P |  | R |

比较对象：D、C

```text
L3: swap   flag, R   # 交换标杆到R处
L4: cmp    L9, L7    # 比较
L5: swap   P, L      # 交换P和L处的人
L6: inc    L         # L = L + 1
L7: inc    P         # P = P + 1
L8: goto   L4        # 跳转
L9: swap   flag, L   # 交换标杆到L处
```

P ≠ R，D比C高，跳转到L7。

---

<!-- Page 114 -->

# 第16步：P右移1步

```text
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处
```

P右移指向E。

---

<!-- Page 115 -->

# 第17步：  
# 跳转

```
L3: swap   flag, R   # 交换标杆到R处
L4: cmp    L9, L7    # 比较
L5: swap   P, L      # 交换P和L处的人
L6: inc    L         # L = L + 1
L7: inc    P         # P = P + 1
L8: goto   L4        # 跳转
L9: swap   flag, L   # 交换标杆到L处
```

```
F    B    A    D    E    C
     L              P    R

          ↓

F    B    A    D    E    C
     L              P    R
```

下一条指令跳转到L4。L、P、R和数据均保持不变。

---

<!-- Page 116 -->

# 第18步：比较

```text
F    B    A    D    E    C
     L              P    R

                  ↓    ↓

                  E    C
```

```text
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处
```

$P \ne R$，E比C高，跳转到L7。

---

<!-- Page 117 -->

# 第19步：  
# P右移1步

## 示意

### 移动前

| 位置 | F | B | A | D | E | C |
|---|---|---|---|---|---|---|
| 人 | F | B | A | D | E | C |
| 指针 |  | L |  |  | P | R |
| 标杆 |  |  |  |  |  | ⚡ |

⬇

### 移动后

| 位置 | F | B | A | D | E | C |
|---|---|---|---|---|---|---|
| 人 | F | B | A | D | E | C |
| 指针 |  | L |  |  |  | P, R |
| 标杆 |  |  |  |  |  | ⚡ |

P右移指向C。

| 行号 | 指令 | 参数 | 注释 |
|---|---|---|---|
| L3 | swap | flag, R | 交换标杆到R处 |
| L4 | cmp | L9, L7 | 比较 |
| L5 | swap | P, L | 交换P和L处的人 |
| L6 | inc | L | \(L = L + 1\) |
| **L7** | **inc** | **P** | **\(P = P + 1\)** |
| L8 | goto | L4 | 跳转 |
| L9 | swap | flag, L | 交换标杆到L处 |

---

<!-- Page 118 -->

# 第20步：跳转

```text
L3: swap   flag, R    # 交换标杆到R处
L4: cmp    L9, L7     # 比较
L5: swap   P, L       # 交换P和L处的人
L6: inc    L          # L = L + 1
L7: inc    P          # P = P + 1
L8: goto   L4         # 跳转
L9: swap   flag, L    # 交换标杆到L处
```

下一条指令跳转到L4。L、P、R和数据均保持不变。

---

<!-- Page 119 -->

# 第21步：比较

```text
上方排列：F  B  A  D  E  C
标杆：C
L：B 处
P：C 处
R：C 右侧
```

↓  

```text
下方排列：F  B  A  D  E  C
标杆：C
L：B 处
P：C 处
R：C 右侧
```

```text
L3: swap    flag, R     # 交换标杆到R处
L4: cmp     L9, L7      # 比较
L5: swap    P, L        # 交换P和L处的人
L6: inc     L           # L = L + 1
L7: inc     P           # P = P + 1
L8: goto    L4          # 跳转
L9: swap    flag, L     # 交换标杆到L处
```

P = R，下一条指令跳转到L9。

---

<!-- Page 120 -->

# 第22步：分区完成

上方分区：

```text
F   B   A   D   E   C
    L           P R
```

下方分区：

```text
F   C   A   D   E   B
    L           P R
```

```text
L3: swap  flag, R   # 交换标杆到R处
L4: cmp   L9, L7    # 比较
L5: swap  P, L      # 交换P和L处的人
L6: inc   L         # L = L + 1
L7: inc   P         # P = P + 1
L8: goto  L4        # 跳转
L9: swap  flag, L   # 交换标杆到L处
```

交换标杆到L处，分区完成。