<!-- Page 1 -->

# 实验-计算机科学导论-课件8

# 图片隐写-2

## FAQ

大湾区大学

---

<!-- Page 2 -->

# 图片隐写-2（4学时）

- 本周目标
  - 回顾图片隐写实验原理与方法
  - 交流讨论隐藏和恢复程序的代码实现

- **学时 1**
  - 比较 `fastsort` 和 `quicksort`
  - 回顾图片隐写实验代码

- **学时 2**
  - 分析隐藏程序算法复杂度
  - 解答图片隐写实验常见问题

- **学时 3 & 学时 4**
  - 尝试实现与交流讨论

---

<!-- Page 3 -->

# 实验： 比较fastsort和quicksort

- 解读右侧代码 `fast_vs_quicksort.py`
  - 在`fastsort.py`基础上添加随机化得到
  - 解释同学们的`fastsort.py`程序没有的新语句
    - 第1、2、9、10、19行
- 第18-23行初始化待排序列表A
  - 选用第22行，列表A的元素值随机产生
  - 选用第23行，列表A的元素从大到小已排好
- 执行右侧代码，感受随机化的加速益处
  - 注释掉第9-10行，程序实现`fastsort`
  - 保留第9-10行，程序实现`quicksort`
  - 观察何种情况下出现明显速度差异
    - 列表A的元素随机产生时，两个算法同样快
    - 列表A的元素从大到小已排好时，`quicksort`快得多

```python
1.  import random    # fast_vs_quicksort.py
2.  import sys

3.  def quicksort(A, p, r):
4.      if p < r:
5.          q = partition(A, p, r)
6.          quicksort(A, p, q-1)
7.          quicksort(A, q+1, r)

8.  def partition(A, p, r):
9.      #    random_index = random.randint(p, r)
10.     #    A[r], A[random_index] = A[random_index], A[r]
11.     i = p
12.     for j in range(p, r):
13.         if A[j] < A[r]:              # 用A[r]作为标杆
14.             A[i], A[j] = A[j], A[i]
15.             i += 1
16.     A[i], A[r] = A[r], A[i]
17.     return i

18. N = 1000000    # 十万时fastsort就很慢了
19. sys.setrecursionlimit(N+2)
20. A = [0] * N
21. for i in range(N):
22.     A[i] = random.randint(1, N)   # activate random A
23.     # A[i] = N - i                # activate ordered A
24. print("Before:", A[:5], "...", A[-5:])
25. quicksort(A, 0, len(A) - 1)
26. print("After:", A[:5], "...", A[-5:])

---

<!-- Page 4 -->

# 1. 如何在计算机中表示图片？

- 本实验中 **BMP** 图片的每个像素用 **3** 字节编码（**24** 位）
- 图片像素阵列的起始地址在 **54** 字节

| 结构名称 | 大小 | 作用 |
|---|---|---|
| `File Header` | 14 字节 | 表明是 **BMP** 文件，存储 **BMP** 文件的通用信息，例如图片大小 |
| `BMP Info Header` | 40 字节 | 存储 **BMP** 文件的详细信息，例如该图片的宽和高 |
| `Pixel Array` | 3\*宽\*高 字节 | 像素阵列 |

| 地址 | 内容 |
|---|---|
| 0<br>1<br>...<br>13 | BMP File Header |
| 14<br>15<br>...<br>53 | BMP Info Header |
| **54**<br>55<br>56<br>... | Pixel Array |

实际上，现在的BMP格式与本实验中的图片格式不完全一致，感兴趣的同学可自行搜索

4

---

<!-- Page 5 -->

# 使用RGB编码像素

- 每个像素使用三元组 $(b,g,r)$ 编码
  - $b$、$g$、$r$ 是 **uint8** $(0-255)$ 类型的整数
  - 分别表示蓝色、绿色和红色的值
- 一个有 $2\times4$ 个像素的图片，需要 $2\times4\times3=24$ 字节存储像素数据
- 该 **BMP** 图片共有 $54+24=78$ 字节

| $(0,0,255)$ | $(0,255,0)$ | $(255,0,0)$ | $(255,0,255)$ |
|---|---|---|---|
| 红色 | 绿色 | 蓝色 | 品红色 |
| 白色 | 黑色 | 黄色 | 青色 |
| $(255,255,255)$ | $(0,0,0)$ | $(0,255,255)$ | $(255,255,0)$ |

从底向上、从左向右顺序存储三元组：

| 顺序 | 像素 | $(b,g,r)$ |
|---|---|---|
| 1 | 白色 | $(255,255,255)$ |
| 2 | 黑色 | $(0,0,0)$ |
| 3 | 黄色 | $(0,255,255)$ |
| 4 | 青色 | $(255,255,0)$ |
| 5 | 红色 | $(0,0,255)$ |
| 6 | 绿色 | $(0,255,0)$ |
| 7 | 蓝色 | $(255,0,0)$ |
| 8 | 品红色 | $(255,0,255)$ |

---

<!-- Page 6 -->

# 保存图片的变量类型

- 在 `Python` 中，图片读入后为 `bytes` 类型
- 使用 `bytearray` 将其转化为可变的
- 将下方 8 个像素的图片读入内存
  - `image[0:54]` 为图片元数据
  - `image[54]` 为第 0 个像素的蓝色通道
  - `image[55]` 为第 0 个像素的绿色通道
  - `image[56]` 为第 0 个像素的红色通道

| `(0, 0, 255)` | `(0, 255, 0)` | `(255, 0, 0)` | `(255, 0, 255)` |
|---|---|---|---|
| 红色 | 绿色 | 蓝色 | 品红色 |
| `(255, 255, 255)` | `(0, 0, 0)` | `(0,255,255)` | `(255,255,0)` |
| 白色 | 黑色 | 黄色 | 青色 |

## 像素数据在内存中的排列

| 蓝色通道 | 绿色通道 | 红色通道 |
|---:|---:|---:|
| 255 | 255 | 255 |
| 0 | 0 | 0 |
| 0 | 255 | 255 |
| 255 | 255 | 0 |
| 0 | 0 | 255 |
| 0 | 255 | 0 |
| 255 | 0 | 0 |
| 255 | 0 | 255 |

## `image` 字节内容示意

| 偏移量 | 内容 |
|---:|---|
| 0 | BMP FILE HEADER |
| 1 | BMP INFO HEADER |
| … | … |
| 53 | BMP INFO HEADER |
| 54 | 255 |
| 55 | 255 |
| 56 | 255 |
| 57 | 0 |
| 58 | 0 |
| 59 | 0 |
| 60 | 0 |
| 61 | 255 |
| 62 | 255 |
| 63 | 255 |
| 64 | 255 |
| 65 | 0 |
| 66 | 0 |
| 67 | 0 |
| 68 | 255 |
| 69 | 0 |
| 70 | 255 |
| 71 | 0 |
| 72 | 255 |
| 73 | 0 |
| 74 | 0 |
| 75 | 255 |
| 76 | 0 |
| 77 | 255 |

---

<!-- Page 7 -->

# 掩码机制(mask machenism)

- 输入： <span style="color:#0070C0;font-weight:bold;">001111</span>11, 001010<span style="color:red;font-weight:bold;">10</span>;　输出：<span style="color:#0070C0;font-weight:bold;">001111</span><span style="color:red;font-weight:bold;">10</span>
  - 如何保留第一个数的前6位，第二个数的后2位，并拼接在一起？

<pre style="background-color:#FFFFCC;padding:12px;"><code>x = 63                       # 把 63=00111111 赋值给变量x
v = 42                       # 把 42=00101010 赋值给变量v
v = v &amp; <span style="color:red;">0x3</span>                  # 按位与，仅保留v的最低2位
x = x &amp; <span style="color:#0070C0;">0xFC</span>                 # 按位与，清除x的最低2位，保留最高6位
x = x | v                    # 按位或，得到最终结果</code></pre>

<pre style="background-color:#FFFFCC;padding:12px;"><code>x = 0b00111111
v = 0b00101010
v = 0b00101010 &amp; <span style="color:red;">0b00000011</span>  # = 000000<span style="color:red;">10</span>
x = 0b00111111 &amp; <span style="color:#0070C0;">0b11111100</span>  # = 001111<span style="color:red;">00</span>
x = 0b00111100 | 0b00000010  # = 001111<span style="color:red;">10</span></code></pre>

---

<!-- Page 8 -->

# 实验原理

- 图片由像素构成，一个像素使用 **3** 个字节存储
- 对于像素阵列，修改每个字节的最低位或最低2位几乎没有视觉差异
- 可以使用掩码机制保留第一个数的前6位，第二个数的后2位
  - 输入：<span style="color:blue">001</span>11111, 001010<span style="color:red">10</span>；输出：<span style="color:blue">001111</span><span style="color:red">10</span>

> 图片隐写的原理：  
> **将文本的每2比特嵌入到图片像素的最低2比特，**  
> 从而在不显著改变视觉效果的情况下隐藏信息！

---

<!-- Page 9 -->

# 隐藏程序：把文本隐藏到BMP图片

- **输入：** 一个文本文件、一个图片文件
- **输出：** 一个修改后的图片文件
- **步骤：**

  1. 获取命令行参数
  2. 读取输入文本和图片的内容
  3. 隐藏文本长度
  4. 隐藏文本内容
  5. 保存修改后的图片

---

<!-- Page 10 -->

# 步骤1. 获取命令行参数

- 使用 `input()` 运行时输入路径
  - 繁琐，输错一个会导致程序无法正确运行，需从头开始
  - `hide.py` 涉及3个文件
    - 原始图片 `autumn.bmp`
    - 原始文本 `hongloumeng.txt`
    - 输出图片 `doctored_autumn.bmp`
- 使用命令行参数
  - 一次性输入所有参数，减少手动交互

```bash
python3 hide.py -i autumn.bmp -t hongloumeng.txt -d doctored_autumn.bmp

---

<!-- Page 11 -->

# 命令行参数

- 导入 `argparse` 模块
  - `argparse` 是 Python 标准库中的一个模块，用于解析命令行参数
  - `args` 对象保存了命令行传入的参数值
  - 我们将这些值分别赋给了 `src_image`，`src_txt`，`dest_image` 变量

```python
import argparse  # 导入argparse模块

parser = argparse.ArgumentParser(description="Hide text in BMP image.")
parser.add_argument("-i", "--image", required=True, help="input image name")
parser.add_argument("-t", "--text", required=True, help="input text name")
parser.add_argument("-d", "--dest", required=True, help="output doctored image name")
args = parser.parse_args()  # 解析命令行参数并存储在args对象中
src_image = args.image  # 获取输入图像文件路径
src_text = args.text    # 获取输入文本文件路径
dest_image = args.dest  # 获取输出图像文件路径

---

<!-- Page 12 -->

# 步骤2. 读取输入文本和图片的内容

- 把输入图片的内容读到变量**p**
- 把输入文本的内容读到变量**t**
  - 注意：需要转换为**bytearray**类型

```python
# --snip--
try:
    with open(src_image, "rb") as f:  # 读取输入图片
        p = bytearray(f.read())
    with open(src_text, "rb") as f:   # 读取输入文本
        t = bytearray(f.read())

---

<!-- Page 13 -->

# 步骤3. 隐藏文本长度

- 文本长度 `len(t)` 是一个整数
  - 计算机中一般常用 **64 比特（8字节）** 表示一个整数
  - 在图像的字节数据中，每个字节表示一个颜色通道
  - 每个图像字节的**最低两个比特**用于隐藏数据
  - 文本长度是一个 **64 比特**数据，使用 \(64/2=32\) 个图像字节来隐藏

---

```text
S = 54   # 标准 BMP 头大小
T = 32   # 用于隐藏文本长度的字节数
C = 4    # 用于隐藏一个字符的字节数
```

---

| `autumn.bmp`<br>隐藏前的 `p` | `doctored_autumn.bmp`<br>隐藏后的 `p` |
|---|---|
| BMP FILE HEADER | BMP FILE HEADER |
| BMP INFO HEADER | BMP INFO HEADER |
| 0th Pixel-B<br>0th Pixel-G<br>0th Pixel-R | Hide 2 bits of `len(t)`<br>Hide 2 bits of `len(t)`<br>Hide 2 bits of `len(t)` |
| ... | ... |
| 10th Pixel-G<br>011110**11**<br>101110**11**<br>010110**10**<br>101001**11** | Hide 2 bits of `len(t)`<br>011110**00**<br>101110**10**<br>010110**00**<br>101001**01** |
| **Pixel Array** | **Pixel Array** |

> 第0个像素的蓝色通道（一个字节）  
> 第0个像素

13

---

<!-- Page 14 -->

# 隐藏文本长度

- 判断图片是否能容纳全部文本并隐藏文本长度
  - 隐藏文本需要的字节数大于图片可用于隐藏的字节数
  - 图片长度为 `len(p)`
    - 前 **54** 字节为元数据，不能修改
    - 使用接下来的 **32** 字节隐藏文本长度
  - 保存文本长度到图像字节数组中
    - `modify(value, pix, idx, size)`
    - 将 `value` 隐藏到 `p[idx:idx+size]` 中

```python
try:
    # --snip--
    if ???:
        raise Exception("too long to hide")  # 提交作业时，请不要修改此行!

    modify(len(t), p, S, T)  # 保存文本长度到图像字节序列中
    # --snip--
except Exception as e:
    print(e)

---

<!-- Page 15 -->

# 步骤4. 隐藏文本内容

- `t[0]` 是要隐藏的第1个字符 `'H' = 72`
  - `t[0] = 'H' = 72 = 01001000`
  - `t[0]` 应该隐藏在 `p[86:90]`
- `t[1]` 应该隐藏在 `p[90:94]`
- `t[i]` 应该隐藏在 `p[S+T+C*i:S+T+C*(i+1)]`

| Original `p[86:90]` | Modified `p[86:90]` |
|---|---|
| 86 `01111011` | 86 `01111000` |
| 87 `10111011` | 87 `10111010` |
| 88 `01011010` | 88 `01011000` |
| 89 `10100111` | 89 `10100101` |

| Autumn.bmp<br>隐藏前的 `p` | doctoredAutumn.bmp<br>隐藏后的 `p` |
|---|---|
| 0 BMP FILE HEADER | 0 BMP FILE HEADER |
| 1 BMP FILE HEADER | 1 BMP FILE HEADER |
| ... | ... |
| 13 BMP FILE HEADER | 13 BMP FILE HEADER |
| 14 BMP INFO HEADER | 14 BMP INFO HEADER |
| 15 BMP INFO HEADER | 15 BMP INFO HEADER |
| ... | ... |
| 53 BMP INFO HEADER | 53 BMP INFO HEADER |
| 54 0th Pixel-B | 54 Hide 2 bits of `len(t)` |
| 55 0th Pixel-G | 55 Hide 2 bits of `len(t)` |
| 56 0th Pixel-R | 56 Hide 2 bits of `len(t)` |
| ... | ... |
| 85 10th Pixel-G | 85 Hide 2 bits of `len(t)` |
| 86 `01111011` | 86 `01111000` |
| 87 `10111011` | 87 `10111010` |
| 88 `01011010` | 88 `01011000` |
| 89 `10100111` | 89 `10100101` |
| 90 | 90 |
| 91 | 91 |
| 92 | 92 |
| 93 Pixel Array | 93 Pixel Array |

```python
try:
    # --snip--
    for i in range(len(t)):
        offset = S + T + C * i     # 从S+T字节开始隐藏，每个字符需要C个字节来隐藏
                                   # 即54+32字节开始隐藏，每字符需要4字节
        modify(t[i], p, offset, C) # 保存文本内容到图像字节序列中

---

<!-- Page 16 -->

# 步骤5. 把变量p保存到输出图片

- 将文本全部隐藏到p后，将p写入到输出图片

```python
try:
    # --snip--

    with open(dest_image, "wb") as f:
        f.write(p)

---

<!-- Page 17 -->

# `modify()`

- `modify(value, pix, idx, size)`
- 作用：将 `value` 隐藏到 `pix[idx:idx+size]`
  - `modify(t[i], p, offset, C),` 当 `i=0` 时
    - `value = t[0] = 'H' = 72 = 0b01001000`
    - `offset = S + T + C * i = 86`
    - `C = 4`
    - 第一次循环：将 `00` 写入 `p[86]` 的最低 2 比特
    - 第二次循环：将 `10` 写入 `p[87]` 的最低 2 比特
    - 第三次循环：将 `00` 写入 `p[88]` 的最低 2 比特
    - 第四次循环：将 `01` 写入 `p[89]` 的最低 2 比特

## Autumn.bmp（隐藏前的 `p`）

| Offset | Content |
|---:|---|
| 0 | BMP FILE HEADER |
| 1 | BMP FILE HEADER |
| ... | |
| 13 | BMP FILE HEADER |
| 14 | BMP INFO HEADER |
| 15 | BMP INFO HEADER |
| ... | |
| 53 | BMP INFO HEADER |
| 54 | 0th Pixel-B |
| 55 | 0th Pixel-G |
| 56 | 0th Pixel-R |
| ... | |
| 85 | 10th Pixel-G |
| 86 | `01111011` |
| 87 | `10111011` |
| 88 | `01011010` |
| 89 | `10100111` |
| 90 | |
| 91 | |
| 92 | Pixel Array |
| 93 | |

## doctoredAutumn.bmp（隐藏后的 `p`）

| Offset | Content |
|---:|---|
| 0 | BMP FILE HEADER |
| 1 | BMP FILE HEADER |
| ... | |
| 13 | BMP FILE HEADER |
| 14 | BMP INFO HEADER |
| 15 | BMP INFO HEADER |
| ... | |
| 53 | BMP INFO HEADER |
| 54 | Hide 2 bits of len(t) |
| 55 | Hide 2 bits of len(t) |
| 56 | Hide 2 bits of len(t) |
| ... | |
| 85 | Hide 2 bits of len(t) |
| 86 | `01111000` |
| 87 | `10111010` |
| 88 | `01011000` |
| 89 | `10100101` |
| 90 | |
| 91 | |
| 92 | Pixel Array |
| 93 | |

```python
def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # TODO: write your code here
        # replace last 2 bits of pix[idx] with last 2 bits of value
        # the next iteration repeats with the next 2 bits of value

---

<!-- Page 18 -->

# 隐藏程序代码框架 `hide.py`

```python
import argparse

S = 54  # 标准 BMP 头大小
T = 32  # 用于隐藏文本长度的字节数
C = 4   # 用于隐藏一个字符的字节数

def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # TODO: write your code here
        # replace last 2 bits of pix[idx] with last 2 bits of value
        # the next iteration repeats with the next 2 bits of value

# 步骤1: 获取命令行参数
try:
    # 步骤2: 读取输入文本和图片的内容
    # 步骤3: 判断图片是否能容纳全部文本，然后隐藏文本长度
    # 步骤4: 隐藏文本内容
    # 步骤5: 把变量p保存到输出图片
except Exception as e:
    print(e)

---

<!-- Page 19 -->

# 恢复程序：把BMP图片中隐藏的文本提取出来

- **输入：** 一个图片文件
- **输出：** 一个恢复后的文本文件
- **步骤：**
  1. 获取命令行参数
  2. 读取输入图片的内容
  3. 恢复文本长度
  4. 恢复文本内容
  5. 将恢复后的内容输出到文件

---

<!-- Page 20 -->

# 恢复程序代码框架 `show.py`

```python
import argparse

# 步骤1：获取命令行参数
parser = argparse.ArgumentParser()
parser.add_argument("-i", "--input_img_path", required=True, help="Input image path.")
parser.add_argument("-t", "--dest_txt_path", required=True, help="Output text path.")
args = parser.parse_args()
src_image = args.input_img_path
dest_text = args.dest_txt_path

# TODO 完成步骤2,3,4，如果需要可以定义新函数

# 步骤5：将恢复后的内容输出到文件
with open(dest_text, "wb") as f:
    f.write(t) # t 是恢复出来的文本内容

---

<!-- Page 21 -->

# 如何检查程序的执行结果？

- 补全`hide.py`与`show.py`代码
- 执行并查看结果
- 比较原始图片和修改后的图片（无视觉差异）
- 比较原始文本和恢复的文本（使用`diff`命令比较，命令行无任何输出）

```bash
$ python3 hide.py -i autumn.bmp -t hongloumeng.txt -d doctored_autumn.bmp
# 观察图片是否有明显视觉差异
$ python3 show.py -i doctored_autumn.bmp -t restored_hongloumeng.txt
$ diff hongloumeng.txt restored_hongloumeng.txt
# 如果没有输出，表示两个文件没有差异
```

| ![autumn.bmp](autumn.bmp) | ![doctored_autumn.bmp](doctored_autumn.bmp) |
|---|---|
| autumn.bmp | doctored_autumn.bmp |

---

<!-- Page 22 -->

# 课堂小测验

- 提交你的 `modify` 函数
  - 作用：将 `value` 隐藏到 `pix[idx:idx+size]`
  - 可以使用下面的代码进行测试
  - 在平台上提交时，仅提交 `modify`，不要包含测试代码

使用电脑的同学可点此链接

```python
def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # TODO: write your code here
        # replace last 2 bits of pix[idx] with last 2 bits of value
        # the next iteration repeats with the next 2 bits of value

# 示例的测试代码
p = bytearray("Hi", 'utf-8')  # 'H' = 72 = 0b01001000, 'i' = 105 = 0b01101001
pix = bytearray([0b11111111, 0b11111111, 0b11111111, 0b11111111, 0b11111111])
idx = 1
size = 4
modify(p[0], pix, idx, size)  # 'H' = 72 = 0b01001000
print([bin(byte) for byte in pix])

---

<!-- Page 23 -->

## 2. 隐藏程序原始代码

- 给定图像文件是 **m** 字节、文本文件是 **n** 字节
  - 给出隐藏程序 `hide.py` 的 `big-O` 公式和 `Omega` 公式

```python
# --snip--

def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # --snip--

# 步骤1: 获取命令行参数
try:
    # 步骤2: 读取输入文本和图片的内容
    # 步骤3: 判断图片是否能容纳全部文本
    modify(len(t), p, S, T) # 隐藏文本长度
    for i in range(len(t)):
        offset = S + T + C * i
        modify(t[i], p, offset, C) # 步骤4: 隐藏文本内容
    # 步骤5: 把变量p保存到输出图片
except Exception as e:
    print(e)

---

<!-- Page 24 -->

# 隐藏程序算法复杂度

- 给定图像文件是 **m** 字节、文本文件是 **n** 字节
  - 给出隐藏程序 `hide.py` 的 **big-O** 公式和 **Omega** 公式
  - 如果在计算复杂度时<span style="color:red">不考虑输入输出</span>

```python
def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # replace last 2 bits of pix[idx] with last 2 bits of value
        # the next iteration repeats with the next 2 bits of value

# 步骤1: 获取命令行参数
# 步骤2: 读取输入文本和图片的内容
# 步骤3: 判断图片是否能容纳全部文本，隐藏文本长度
for i in range(len(t)):
    # 步骤4: 隐藏文本内容
# 步骤5: 把变量p保存到输出图片

---

<!-- Page 25 -->

# 隐藏程序算法复杂度

- 给定图像文件是**m**字节、文本文件是**n**字节
  - 给出隐藏程序 `hide.py` 的 `big-O` 公式和 `Omega` 公式
  - 如果在计算复杂度时 <span style="color:red">考虑输入输出</span>

```python
def modify(value, pix, idx, size):
    """Hide value in pix[idx] ~ pix[idx+size-1]."""
    for i in range(size):
        # replace last 2 bits of pix[idx] with last 2 bits of value
        # the next iteration repeats with the next 2 bits of value

# 步骤1：获取命令行参数
# 步骤2：读取输入文本和图片的内容
# 步骤3：判断图片是否能容纳全部文本，隐藏文本长度
for i in range(len(t)):
    # 步骤4：隐藏文本内容
# 步骤5：把变量p保存到输出图片

---

<!-- Page 26 -->

# 隐藏程序常见问题

- `modify(value, pix, idx, size)`函数中，`value`的数据类型是什么？
  - 隐藏长度时，`modify(len(t), p, S, T)`，`len(t)`是一个`int`
  - 隐藏文本时，`modify(t[i], p, offset, C)`，`t[i]`是一个`byte`
  - 为什么对于这两个不同的类型，`modify`都能正确隐藏？
  - 为什么隐藏长度和隐藏文本都能复用这同一个函数？
  - `modify`函数必须包含`idx`和`size`这两个参数吗？去掉是否可行？

---

<!-- Page 27 -->

# 隐藏程序常见问题

- `modify(value, pix, idx, size)` 函数不需要返回值吗？
  - 我在 `modify` 函数中修改了 `p` 中的元素，为什么该函数外面的 `p` 也修改了？

---

<!-- Page 28 -->

# 恢复程序常见问题

- 恢复程序毫无思路，不知道怎么下手，该怎么办？
  - 隐藏程序五个步骤
    - 获取命令行参数
    - 读取输入文本和图片的内容
    - 隐藏文本长度
    - 隐藏文本内容
    - 保存修改后的图片
  - 相应地，恢复程序五个步骤
    - 获取命令行参数
    - 读取输入图片的内容
    - 恢复文本长度
    - 恢复文本内容
    - 将恢复后的内容输出到文件
  - 隐藏程序使用 `modify` 函数，恢复程序是否能实现对应的 `recover` 函数？
    - 如果可以，那么它的功能是什么？
    - 它的参数是什么？是否需要有返回值？

---

<!-- Page 29 -->

# 恢复程序常见问题

- 在隐藏程序中，隐藏到p中即可。在恢复程序中，恢复出来的文本应该怎么处理？使用的变量类型是什么？

```python
a = bytearray()                 # 创建一个空实例
data = bytearray(b"hello")      # 将bytes类型转化为bytearray类型
a.append(data[0])               # 使用 append() 将 h 添加到 a 中
print(a)                        # bytearray(b'h')

---

<!-- Page 30 -->

# 恢复程序常见问题

- 我的代码有`bug`，恢复出来的文本是空的/乱码，怎么办？
  - 恢复出的长度是否是正确的？可以在代码中加入`print`语句，打印出相关信息
    - 注意：在平台上提交代码时删去你加入的额外`print`语句，否则会被判为`WA`
  - `recover`函数的行为是否和你预期的一样？
    - 可以参考本次课堂小测为`modify`函数写的测试代码，为你的`recover`函数写一段类似的测试代码，单独测试这个函数的功能

---

<!-- Page 31 -->

# 实验课作业

![autumn.bmp](autumn.bmp) ![doctored_autumn.bmp](doctored_autumn.bmp)

- 补全`hide.py`与`show.py`代码
- 执行并查看结果
- 比较原始图片和修改后的图片（无视觉差异）
- 比较原始文本和恢复的文本（使用`diff`命令比较，命令行无任何输出）
- 提交`hide.py`与`show.py`
  - 注意：不要修改输入与输出相关代码

```bash
$ python3 hide.py -i autumn.bmp -t hongloumeng.txt -d doctored_autumn.bmp
# 观察图片是否有明显视觉差异
$ python3 show.py -i doctored_autumn.bmp -t restored_hongloumeng.txt
$ diff hongloumeng.txt restored_hongloumeng.txt
# 如果没有输出，表示两个文件没有差异
```

31

---

<!-- Page 32 -->

# 3. 尝试实现

- 请尝试实现你的隐藏和恢复程序

---

<!-- Page 33 -->

# 4. 交流讨论

- 交流你的解决方案/思路/遇到的困难

---

<!-- Page 34 -->

# 课程追求：珍惜时代、体认思维、学生走心、作品牵引

## 李晓明 徐志伟｜大湾区大学